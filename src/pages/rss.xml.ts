import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { SITE_TITLE, SITE_DESCRIPTION, SITE_URL } from '../consts';
import { sortPostsByDate } from '../utils/posts';

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getPlainExcerpt(body: string = '', maxLength: number = 160): string {
  const plain = body
    .replace(/^---[\s\S]*?---/, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
    .replace(/[#*`~>_[\]()!+-=|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > maxLength ? `${plain.slice(0, maxLength)}...` : plain;
}

export async function GET(context: APIContext) {
  const posts = await getCollection('posts');
  const sortedPosts = sortPostsByDate(posts);

  const siteUrl = (
    SITE_URL ||
    context.site?.toString() ||
    context.url.origin
  ).replace(/\/$/, '');
  const rssUrl = `${siteUrl}/rss.xml`;
  const lastBuildDate =
    sortedPosts.length > 0
      ? (sortedPosts[0].data.updatedDate ?? sortedPosts[0].data.pubDate).toUTCString()
      : new Date().toUTCString();

  const itemsXml = sortedPosts
    .map((post) => {
      const postUrl = `${siteUrl}/posts/${encodeURI(post.id)}`;
      const description =
        post.data.description || getPlainExcerpt(post.body);
      const categories = (post.data.tags || [])
        .map((tag: string) => `      <category>${escapeXml(tag)}</category>`)
        .join('\n');

      return [
        '    <item>',
        `      <title>${escapeXml(post.data.title)}</title>`,
        `      <link>${escapeXml(postUrl)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(postUrl)}</guid>`,
        `      <description>${escapeXml(description)}</description>`,
        `      <pubDate>${post.data.pubDate.toUTCString()}</pubDate>`,
        categories,
        '    </item>',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <link>${escapeXml(siteUrl)}</link>
    <atom:link href="${escapeXml(rssUrl)}" rel="self" type="application/rss+xml" />
    <language>zh-CN</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
${itemsXml}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
}
