import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FAVICON_DIR = path.resolve(process.cwd(), 'public/favicons');
const FETCH_TIMEOUT_MS = 10000;
/** 单个域名最多尝试次数（网络抖动/限流时自动重试） */
const MAX_ATTEMPTS = 3;
/** 构建阶段并发抓取上限，避免触发图标服务限流 */
const MAX_CONCURRENCY = 3;
/** 失败缓存有效期：避免同一轮构建/同一页面渲染中重复请求，同时允许开发态稍后重试 */
const FAILURE_CACHE_TTL_MS = 60_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** hostname -> { at, error } */
const failedDomains = new Map();
/** hostname -> Promise<string> */
const pendingRequests = new Map();

/**
 * Favicon 获取失败错误：携带域名与具体原因，便于在构建日志中定位。
 */
export class FaviconFetchError extends Error {
  /**
   * @param {string} hostname
   * @param {string} reason
   * @param {{ cause?: unknown, retryable?: boolean }} [options]
   */
  constructor(hostname, reason, options = {}) {
    const sourceUrl = faviconSourceUrl(hostname);
    super(`无法获取站外链接图标 ${hostname}（${sourceUrl}）：${reason}`, { cause: options.cause });
    this.name = 'FaviconFetchError';
    this.hostname = hostname;
    this.sourceUrl = sourceUrl;
    this.reason = reason;
    /** 是否为可重试的瞬时错误（超时、网络异常、限流、服务端错误） */
    this.retryable = options.retryable ?? false;
  }
}

function faviconSourceUrl(hostname) {
  return `https://icons.duckduckgo.com/ip3/${hostname}.ico`;
}

/**
 * 确保目录存在
 */
function ensureDir() {
  if (!fs.existsSync(FAVICON_DIR)) {
    fs.mkdirSync(FAVICON_DIR, { recursive: true });
  }
}

/**
 * 将域名转换为安全的文件名
 */
function sanitizeHostname(hostname) {
  return hostname.replace(/[^a-zA-Z0-9.-]/g, '_');
}

/**
 * @param {string} hostname
 */
function faviconPaths(hostname) {
  const fileName = `${sanitizeHostname(hostname)}.ico`;
  return {
    fileName,
    filePath: path.join(FAVICON_DIR, fileName),
    publicPath: `/favicons/${fileName}`,
  };
}

/**
 * 返回域名对应的本地公开访问路径（不保证文件已存在，
 * 文件由 faviconCacheIntegration 在开发/构建阶段保证）。
 *
 * @param {string} hostname
 */
export function faviconPublicPath(hostname) {
  return faviconPaths(hostname).publicPath;
}

/**
 * 根据文件头解析图标的 MIME 类型；无法识别时返回 null。
 * 同时用于内容校验（非图片则不写入缓存）与开发服务器回源的 Content-Type。
 *
 * @param {Uint8Array} buffer
 * @returns {string | null}
 */
function detectImageMime(buffer) {
  const startsWith = (bytes) =>
    buffer.length >= bytes.length && bytes.every((byte, index) => buffer[index] === byte);

  // ICO / CUR
  if (startsWith([0x00, 0x00, 0x01, 0x00]) || startsWith([0x00, 0x00, 0x02, 0x00])) {
    return 'image/x-icon';
  }
  // PNG
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  // GIF
  if (startsWith([0x47, 0x49, 0x46, 0x38])) return 'image/gif';
  // JPEG
  if (startsWith([0xff, 0xd8, 0xff])) return 'image/jpeg';
  // WEBP (RIFF....WEBP)
  if (
    startsWith([0x52, 0x49, 0x46, 0x46]) &&
    buffer.length >= 12 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }
  // SVG / XML 文本（XML 声明后必须真的跟着 <svg>，避免把 XML 格式的错误响应当成图标）
  const head = new TextDecoder().decode(buffer.subarray(0, 512)).trimStart().toLowerCase();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) {
    return 'image/svg+xml';
  }

  return null;
}

/**
 * 校验内容确实是一张图片（ICO / PNG / GIF / JPEG / WEBP / SVG）。
 *
 * @param {Uint8Array} buffer
 */
function isImageBuffer(buffer) {
  return detectImageMime(buffer) !== null;
}

/**
 * 从远程拉取图标二进制内容（单次尝试），失败时抛出 FaviconFetchError。
 *
 * @param {string} hostname
 * @returns {Promise<Uint8Array>}
 */
async function downloadFaviconOnce(hostname) {
  const sourceUrl = faviconSourceUrl(hostname);
  let response;

  try {
    response = await fetch(sourceUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BlogFaviconFetcher/1.0)',
        Accept: 'image/*',
      },
    });
  } catch (err) {
    const reason =
      err?.name === 'TimeoutError' || err?.name === 'AbortError'
        ? `请求超时（>${FETCH_TIMEOUT_MS / 1000}s）`
        : `网络请求失败：${err?.message ?? String(err)}`;
    throw new FaviconFetchError(hostname, reason, { cause: err, retryable: true });
  }

  if (!response.ok) {
    const statusText = response.statusText ? ` ${response.statusText}` : '';
    const retryable =
      response.status === 429 || response.status === 408 || response.status >= 500;
    throw new FaviconFetchError(
      hostname,
      `服务端返回 HTTP ${response.status}${statusText}`,
      { retryable }
    );
  }

  let buffer;
  try {
    buffer = new Uint8Array(await response.arrayBuffer());
  } catch (err) {
    throw new FaviconFetchError(hostname, `读取响应内容失败：${err?.message ?? String(err)}`, {
      cause: err,
      retryable: true,
    });
  }

  if (buffer.byteLength === 0) {
    // 上游对未收录图标的域名会返回 200 + 空响应，重试没有意义
    throw new FaviconFetchError(
      hostname,
      '该域名没有可用的图标（图标服务返回空响应）',
      { retryable: false }
    );
  }

  if (!isImageBuffer(buffer)) {
    const contentType = response.headers.get('content-type') || '未知';
    throw new FaviconFetchError(
      hostname,
      `返回内容不是有效的图片（Content-Type: ${contentType}）`
    );
  }

  return buffer;
}

/**
 * 拉取图标内容，瞬时错误会自动重试，最终仍失败则抛出 FaviconFetchError。
 *
 * @param {string} hostname
 * @returns {Promise<Uint8Array>}
 */
async function downloadFavicon(hostname) {
  /** @type {unknown} */
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await downloadFaviconOnce(hostname);
    } catch (err) {
      lastError = err;
      const retryable = err instanceof FaviconFetchError && err.retryable;
      if (!retryable || attempt === MAX_ATTEMPTS) break;
      await sleep(attempt * 600);
    }
  }

  throw lastError;
}

/**
 * 获取本地私有化的 Favicon 地址。
 * 如果本地已存在，直接返回；如果不存在，从远程下载并保存到本地。
 * 任何一步失败都会抛出 FaviconFetchError（不再静默降级为纯文字链接）。
 *
 * @param {string} hostname
 * @returns {Promise<string>} 本地访问路径（如 `/favicons/github.com.ico`）
 * @throws {FaviconFetchError}
 */
export async function getOrFetchFavicon(hostname) {
  if (!hostname) {
    throw new FaviconFetchError(String(hostname), '缺少域名');
  }

  ensureDir();
  const { filePath, publicPath } = faviconPaths(hostname);

  // 1. 本地已存在有效缓存（旧版本可能把错误页写进缓存，需重新校验）
  if (fs.existsSync(filePath)) {
    try {
      const cached = fs.readFileSync(filePath);
      if (isImageBuffer(cached)) {
        return publicPath;
      }
    } catch {
      // 忽略读取异常，尝试重新抓取
    }
  }

  // 2. 近期失败过的域名直接复用错误，避免重复请求
  const cachedFailure = failedDomains.get(hostname);
  if (cachedFailure) {
    if (Date.now() - cachedFailure.at < FAILURE_CACHE_TTL_MS) {
      throw cachedFailure.error;
    }
    failedDomains.delete(hostname);
  }

  // 3. 如果当前有正在进行的相同域名的抓取请求，直接复用 Promise
  if (pendingRequests.has(hostname)) {
    return pendingRequests.get(hostname);
  }

  // 4. 发起远程抓取并私有化存储
  const fetchPromise = (async () => {
    try {
      const buffer = await downloadFavicon(hostname);

      try {
        fs.writeFileSync(filePath, buffer);
      } catch (err) {
        throw new FaviconFetchError(
          hostname,
          `写入本地缓存 ${path.relative(process.cwd(), filePath)} 失败：${err?.message ?? String(err)}`,
          { cause: err }
        );
      }

      failedDomains.delete(hostname);
      return publicPath;
    } catch (err) {
      const error =
        err instanceof FaviconFetchError
          ? err
          : new FaviconFetchError(hostname, err?.message ?? String(err), { cause: err });
      failedDomains.set(hostname, { at: Date.now(), error });
      throw error;
    } finally {
      pendingRequests.delete(hostname);
    }
  })();

  pendingRequests.set(hostname, fetchPromise);
  return fetchPromise;
}

/**
 * Astro 集成：确保即便命中 Astro 内容层缓存（跳过 Markdown 重编译），
 * 构建与开发时也会自动检查并补齐所有缺失的 Favicon 图标文件。
 * 任何缺失或抓取失败都会报错，构建会直接失败退出。
 */
export function faviconCacheIntegration() {
  return {
    name: 'favicon-cache-sync',
    hooks: {
      'astro:server:setup': ({ server }) => {
        server.middlewares.use(async (req, res, next) => {
          // 去掉 query string：浏览器/开发工具可能附加 ?t=xxx 时间戳
          const pathname = (req.url ?? '').split('?')[0];
          const match = pathname.match(/^\/favicons\/([a-zA-Z0-9._-]+)\.ico$/);
          if (!match) {
            next();
            return;
          }

          try {
            const { filePath } = faviconPaths(match[1]);
            await getOrFetchFavicon(match[1]);
            const buffer = fs.readFileSync(filePath);
            res.statusCode = 200;
            // 仅返回已校验过的图片类型，未知内容不回退到可执行的 SVG
            res.setHeader('Content-Type', detectImageMime(buffer) ?? 'application/octet-stream');
            res.setHeader('Content-Length', String(buffer.byteLength));
            // 图标按域名固定，允许浏览器短时缓存，避免反复同步读盘
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.end(buffer);
          } catch (err) {
            server.config.logger.error(`[favicon] ${err?.message ?? String(err)}`);
            res.statusCode = 502;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store');
            res.end(`Favicon 获取失败：${err?.message ?? String(err)}\n`);
          }
        });
      },
      'astro:build:done': async ({ dir, logger }) => {
        const distDir = fileURLToPath(dir);
        const htmlFiles = [];

        function walk(currentDir) {
          if (!fs.existsSync(currentDir)) return;
          for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
            const fullPath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
              walk(fullPath);
            } else if (entry.name.endsWith('.html')) {
              htmlFiles.push(fullPath);
            }
          }
        }

        walk(distDir);

        /** @type {Map<string, Set<string>>} hostname -> 引用它的页面 */
        const hostnames = new Map();
        // 只从带 link-favicon 类的 <img> 标签中提取，避免把正文/代码块里的
        // 路径文本（如 /favicons/test.ico）当成域名请求
        const imgTagRegex = /<img\b[^>]*>/gi;
        const linkFaviconClassRegex = /class="[^"]*\blink-favicon\b[^"]*"/i;
        const faviconSrcRegex = /src="\/favicons\/([a-zA-Z0-9._-]+)\.ico"/i;

        for (const htmlFile of htmlFiles) {
          const content = fs.readFileSync(htmlFile, 'utf-8');
          const pagePath = path.relative(distDir, htmlFile);

          for (const tag of content.match(imgTagRegex) ?? []) {
            if (!linkFaviconClassRegex.test(tag)) continue;
            const srcMatch = tag.match(faviconSrcRegex);
            if (!srcMatch) continue;

            const pages = hostnames.get(srcMatch[1]) ?? new Set();
            pages.add(pagePath);
            hostnames.set(srcMatch[1], pages);
          }
        }

        if (hostnames.size === 0) return;

        const distFaviconDir = path.join(distDir, 'favicons');
        if (!fs.existsSync(distFaviconDir)) {
          fs.mkdirSync(distFaviconDir, { recursive: true });
        }

        /** @type {string[]} */
        const failures = [];

        // 限制并发数，避免图标服务限流导致误报
        const entries = Array.from(hostnames.entries());
        let cursor = 0;

        const worker = async () => {
          while (cursor < entries.length) {
            const [hostname, pages] = entries[cursor];
            cursor += 1;

            try {
              const { fileName } = faviconPaths(hostname);
              await getOrFetchFavicon(hostname);
              const srcFile = path.join(FAVICON_DIR, fileName);
              const destFile = path.join(distFaviconDir, fileName);
              fs.copyFileSync(srcFile, destFile);
            } catch (err) {
              const message =
                err instanceof FaviconFetchError
                  ? err.message
                  : `无法获取站外链接图标 ${hostname}：${err?.message ?? String(err)}`;
              const referencedBy = Array.from(pages).join('、');
              failures.push(`${message}\n    被引用于：${referencedBy}`);
            }
          }
        };

        await Promise.all(
          Array.from({ length: Math.min(MAX_CONCURRENCY, entries.length) }, () => worker())
        );

        if (failures.length > 0) {
          const report =
            `站外链接 Favicon 获取失败，构建已中止（共 ${failures.length} 个）：\n` +
            failures.map((message) => `  - ${message}`).join('\n') +
            '\n  提示：图标来自 DuckDuckGo 图标服务，站点没有收录图标也会被视为失败；\n' +
            '  请移除该外链，或换用有可用图标的链接地址。';
          for (const message of failures) {
            logger?.error(`[favicon] ${message}`);
          }
          throw new Error(report);
        }
      },
    },
  };
}
