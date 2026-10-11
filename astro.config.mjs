// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import { rehypeContentEnhancer } from './src/plugins/rehype-content-enhancer.mjs';
import { SITE_URL } from './src/consts.ts';

// https://astro.build/config
export default defineConfig({
  site: SITE_URL || undefined,
  markdown: {
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
    },
    processor: unified({
      rehypePlugins: [rehypeContentEnhancer],
    }),
  },
});
