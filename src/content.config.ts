import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    words: z.number().optional(),
    tags: z
      .preprocess((val) => {
        if (!val) return [];
        if (typeof val === 'string') return [val];
        return val;
      }, z.array(z.string()))
      .default([]),
  }),
});

export const collections = { posts };
