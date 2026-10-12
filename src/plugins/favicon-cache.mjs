import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FAVICON_DIR = path.resolve(process.cwd(), 'public/favicons');
const failedDomains = new Set();
const pendingRequests = new Map();

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
 * 获取本地私有化的 Favicon 地址。
 * 如果本地已存在，直接返回；如果不存在，从 DuckDuckGo 下载并保存到本地。
 * 如果下载失败，返回 null（链接保持纯文字）。
 *
 * @param {string} hostname
 * @returns {Promise<string | null>} 本地访问路径（如 `/favicons/github.com.ico`）或 null
 */
export async function getOrFetchFavicon(hostname) {
  if (!hostname || failedDomains.has(hostname)) {
    return null;
  }

  ensureDir();
  const safeName = sanitizeHostname(hostname);
  const fileName = `${safeName}.ico`;
  const filePath = path.join(FAVICON_DIR, fileName);
  const publicPath = `/favicons/${fileName}`;

  // 1. 本地已存在有效缓存
  if (fs.existsSync(filePath)) {
    try {
      const stat = fs.statSync(filePath);
      if (stat.size > 0) {
        return publicPath;
      }
    } catch {
      // 忽略读取异常，尝试重新抓取
    }
  }

  // 2. 如果当前有正在进行的相同域名的抓取请求，直接复用 Promise
  if (pendingRequests.has(hostname)) {
    return pendingRequests.get(hostname);
  }

  // 3. 构建时发起远程抓取并私有化存储
  const fetchPromise = (async () => {
    try {
      const sourceUrl = `https://icons.duckduckgo.com/ip3/${hostname}.ico`;
      const response = await fetch(sourceUrl, {
        signal: AbortSignal.timeout(10000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; BlogFaviconFetcher/1.0)',
        },
      });

      if (!response.ok) {
        failedDomains.add(hostname);
        return null;
      }

      const buffer = new Uint8Array(await response.arrayBuffer());
      if (buffer.byteLength === 0) {
        failedDomains.add(hostname);
        return null;
      }

      fs.writeFileSync(filePath, buffer);
      return publicPath;
    } catch (err) {
      failedDomains.add(hostname);
      return null;
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
 */
export function faviconCacheIntegration() {
  return {
    name: 'favicon-cache-sync',
    hooks: {
      'astro:server:setup': ({ server }) => {
        server.middlewares.use(async (req, _res, next) => {
          const match = req.url?.match(/^\/favicons\/([a-zA-Z0-9._-]+)\.ico$/);
          if (match) {
            await getOrFetchFavicon(match[1]);
          }
          next();
        });
      },
      'astro:build:done': async ({ dir }) => {
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

        const hostnames = new Set();
        const faviconRegex = /\/favicons\/([a-zA-Z0-9._-]+)\.ico/g;

        for (const htmlFile of htmlFiles) {
          const content = fs.readFileSync(htmlFile, 'utf-8');
          let match;
          while ((match = faviconRegex.exec(content)) !== null) {
            hostnames.add(match[1]);
          }
        }

        if (hostnames.size === 0) return;

        const distFaviconDir = path.join(distDir, 'favicons');
        if (!fs.existsSync(distFaviconDir)) {
          fs.mkdirSync(distFaviconDir, { recursive: true });
        }

        await Promise.all(
          Array.from(hostnames).map(async (hostname) => {
            const result = await getOrFetchFavicon(hostname);
            if (!result) return;
            const srcFile = path.join(FAVICON_DIR, `${sanitizeHostname(hostname)}.ico`);
            const destFile = path.join(distFaviconDir, `${sanitizeHostname(hostname)}.ico`);
            if (fs.existsSync(srcFile)) {
              fs.copyFileSync(srcFile, destFile);
            }
          })
        );
      },
    },
  };
}

