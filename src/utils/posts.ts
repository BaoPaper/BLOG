import type { CollectionEntry } from 'astro:content';

/**
 * 将日期格式化为 YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * 按发布日期降序排序文章（不修改原数组）
 */
export function sortPostsByDate(
  posts: CollectionEntry<'posts'>[]
): CollectionEntry<'posts'>[] {
  return [...posts].sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );
}

/**
 * 统计所有文章的标签数量并按篇数降序（篇数相同时按中文拼音序）排列
 */
export function getTagStats(posts: CollectionEntry<'posts'>[]): {
  tagCounts: Record<string, number>;
  allTags: string[];
} {
  const tagCounts = posts.reduce<Record<string, number>>((acc, post) => {
    (post.data.tags || []).forEach((tag: string) => {
      acc[tag] = (acc[tag] || 0) + 1;
    });
    return acc;
  }, {});

  const allTags = Object.keys(tagCounts).sort((a, b) => {
    const diff = tagCounts[b] - tagCounts[a];
    return diff !== 0 ? diff : a.localeCompare(b, 'zh-Hans-CN');
  });

  return { tagCounts, allTags };
}

/**
 * 构建期静态估算 Markdown 正文字数（中文字数 + 英文词数）
 */
export function getWordCount(content: string = ''): number {
  const clean = content.replace(/^---[\s\S]*?---/, '');
  const chineseChars = clean.match(/[\u4e00-\u9fa5]/g) || [];
  const englishWords =
    clean
      .replace(/[\u4e00-\u9fa5]/g, ' ')
      .replace(/[#*`~>_[\]()!+-=]/g, ' ')
      .match(/[a-zA-Z0-9_-]+/g) || [];
  return chineseChars.length + englishWords.length;
}
