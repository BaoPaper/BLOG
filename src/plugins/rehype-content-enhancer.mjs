const LANG_MAP = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  jsx: 'JSX',
  tsx: 'TSX',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  sass: 'Sass',
  less: 'Less',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  py: 'Python',
  python: 'Python',
  rb: 'Ruby',
  ruby: 'Ruby',
  go: 'Go',
  rust: 'Rust',
  rs: 'Rust',
  java: 'Java',
  c: 'C',
  cpp: 'C++',
  'c++': 'C++',
  cs: 'C#',
  csharp: 'C#',
  php: 'PHP',
  sh: 'Bash',
  bash: 'Bash',
  zsh: 'Zsh',
  shell: 'Shell',
  sql: 'SQL',
  md: 'Markdown',
  markdown: 'Markdown',
  astro: 'Astro',
  vue: 'Vue',
  svelte: 'Svelte',
  dockerfile: 'Dockerfile',
  docker: 'Docker',
  graphql: 'GraphQL',
  toml: 'TOML',
  ini: 'INI',
  xml: 'XML',
  diff: 'Diff',
  plaintext: 'Text',
  txt: 'Text',
};

function formatLang(rawLang) {
  if (!rawLang) return 'Code';
  const clean = rawLang.trim().toLowerCase();
  if (LANG_MAP[clean]) return LANG_MAP[clean];
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function walkTree(node, visitor, index = 0, parent = null) {
  if (!node || typeof node !== 'object') return;
  const replacement = visitor(node, index, parent);
  if (replacement && parent && Array.isArray(parent.children)) {
    parent.children[index] = replacement;
    node = replacement;
  }
  if (Array.isArray(node.children)) {
    for (let i = 0; i < node.children.length; i++) {
      walkTree(node.children[i], visitor, i, node);
    }
  }
}

export function rehypeContentEnhancer() {
  return (tree) => {
    walkTree(tree, (node, index, parent) => {
      // 1. 静态图注转换：检测仅包含单张图片的段落或带有 alt 的图片
      if (node.type === 'element' && node.tagName === 'p') {
        const nonWhitespaceChildren = (node.children || []).filter(
          (c) => !(c.type === 'text' && !c.value.trim())
        );

        if (nonWhitespaceChildren.length === 1 && nonWhitespaceChildren[0].tagName === 'img') {
          const imgNode = nonWhitespaceChildren[0];
          const altText = (imgNode.properties?.alt || imgNode.properties?.title || '').toString().trim();

          if (altText) {
            return {
              type: 'element',
              tagName: 'figure',
              properties: { className: ['prose-figure'] },
              children: [
                imgNode,
                {
                  type: 'element',
                  tagName: 'figcaption',
                  properties: { className: ['prose-caption'] },
                  children: [
                    {
                      type: 'element',
                      tagName: 'span',
                      properties: { className: ['caption-text'] },
                      children: [{ type: 'text', value: altText }],
                    },
                  ],
                },
              ],
            };
          }
        }
      }

      // 2. 静态代码块包装与顶栏生成
      if (node.type === 'element' && node.tagName === 'pre') {
        if (parent?.properties?.className?.includes?.('code-block-wrapper')) {
          return;
        }

        // 检查 pre 或者内部 code 的 class
                // 检查 pre 或者内部 code 的 class
        let rawLang =
          node.properties?.dataLanguage ||
          node.properties?.['data-language'] ||
          node.properties?.language ||
          '';

        const codeChild = (node.children || []).find((c) => c.tagName === 'code');
        if (!rawLang && codeChild?.properties?.className) {
          const classes = Array.isArray(codeChild.properties.className)
            ? codeChild.properties.className
            : [codeChild.properties.className];
          const langClass = classes.find((c) => c.startsWith('language-'));
          if (langClass) rawLang = langClass.replace('language-', '');
        }

        if (!rawLang && node.properties?.className) {
          const classes = Array.isArray(node.properties.className)
            ? node.properties.className
            : [node.properties.className];
          const langClass = classes.find((c) => c.startsWith('language-'));
          if (langClass) rawLang = langClass.replace('language-', '');
        }

        const langName = formatLang(rawLang);

        const wrapper = {
          type: 'element',
          tagName: 'div',
          properties: { className: ['code-block-wrapper'] },
          children: [
            // 顶栏
            {
              type: 'element',
              tagName: 'div',
              properties: { className: ['code-block-header'] },
              children: [
                {
                  type: 'element',
                  tagName: 'span',
                  properties: { className: ['code-block-lang'] },
                  children: [{ type: 'text', value: langName }],
                },
                {
                  type: 'element',
                  tagName: 'button',
                  properties: {
                    className: ['code-copy-btn'],
                    type: 'button',
                    'aria-label': '复制代码',
                    title: '复制代码',
                  },
                  children: [
                    {
                      type: 'element',
                      tagName: 'svg',
                      properties: {
                        className: ['copy-icon', 'icon-copy'],
                        viewBox: '0 0 24 24',
                        width: '14',
                        height: '14',
                        fill: 'none',
                        stroke: 'currentColor',
                        strokeWidth: '2',
                        strokeLinecap: 'round',
                        strokeLinejoin: 'round',
                      },
                      children: [
                        {
                          type: 'element',
                          tagName: 'rect',
                          properties: { x: '9', y: '9', width: '13', height: '13', rx: '2', ry: '2' },
                          children: [],
                        },
                        {
                          type: 'element',
                          tagName: 'path',
                          properties: { d: 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' },
                          children: [],
                        },
                      ],
                    },
                    {
                      type: 'element',
                      tagName: 'svg',
                      properties: {
                        className: ['copy-icon', 'icon-check'],
                        viewBox: '0 0 24 24',
                        width: '14',
                        height: '14',
                        fill: 'none',
                        stroke: 'currentColor',
                        strokeWidth: '2.5',
                        strokeLinecap: 'round',
                        strokeLinejoin: 'round',
                      },
                      children: [
                        {
                          type: 'element',
                          tagName: 'polyline',
                          properties: { points: '20 6 9 17 4 12' },
                          children: [],
                        },
                      ],
                    },
                    {
                      type: 'element',
                      tagName: 'span',
                      properties: { className: ['code-copy-text'] },
                      children: [{ type: 'text', value: '复制' }],
                    },
                  ],
                },
              ],
            },
            // 原 pre
            node,
          ],
        };

        return wrapper;
      }
    });
  };
}
