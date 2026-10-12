import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const isDirMode = args.includes('--dir') || args.includes('-d');
const positional = args.filter((arg) => !arg.startsWith('-'));

if (positional.length === 0) {
  console.log('用法:');
  console.log('  pnpm new <文件名/slug> [文章标题] [--dir|-d]');
  console.log('\n示例:');
  console.log('  pnpm new my-first-post "我的第一篇文章"');
  console.log('  pnpm new my-post-with-images "带图文章" --dir');
  process.exit(1);
}

const rawSlug = positional[0].replace(/\.mdx?$/i, '').trim();
const title = (positional[1] || rawSlug).trim();

// 生成当前本地日期时间 (YYYY-MM-DD HH:mm:ss)
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const pubDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

const postsDir = path.resolve(process.cwd(), 'src/content/posts');
const targetPath = isDirMode
  ? path.join(postsDir, rawSlug, 'index.md')
  : path.join(postsDir, `${rawSlug}.md`);

if (fs.existsSync(targetPath)) {
  console.error(`错误: 文章已存在 -> ${path.relative(process.cwd(), targetPath)}`);
  process.exit(1);
}

const template = `---
title: ${title}
description: 
pubDate: ${pubDate}
tags: []
---

`;

fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.writeFileSync(targetPath, template, 'utf-8');

console.log(`已创建新文章: ${path.relative(process.cwd(), targetPath)}`);
