// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import { rehypeContentEnhancer } from './src/plugins/rehype-content-enhancer.mjs';

// https://astro.build/config
export default defineConfig({
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
