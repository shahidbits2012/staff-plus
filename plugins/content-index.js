/**
 * content-index plugin
 *
 * Extracts problem doc metadata at build time and exposes it via
 * globalData for the /problems catalog page.
 */
const categories = require('../config/problem-categories.json');

module.exports = function contentIndex() {
  return {
    name: 'content-index',

    async allContentLoaded({allContent, actions}) {
      const docsPlugin = allContent['docusaurus-plugin-content-docs'];
      if (!docsPlugin) return;
      const docs = docsPlugin.default.loadedVersions[0].docs;

      const problems = docs
        .filter((d) => d.id.startsWith('problems/'))
        .filter((d) => !d.id.endsWith('/index'))
        .map((d) => {
          // Derive category dir from the id: "problems/<dir>/slug"
          const parts = d.id.split('/');
          const category = parts.length >= 2 ? parts[1] : '';
          return {
            id: d.id,
            title: d.title,
            permalink: d.permalink,
            summary: d.frontMatter.summary ?? d.description ?? '',
            status: d.frontMatter.status ?? 'complete',
            difficulty: d.frontMatter.difficulty ?? null,
            category,
          };
        });

      actions.setGlobalData({problems, categories});
    },
  };
};
