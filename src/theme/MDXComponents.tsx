import MDXComponents from '@theme-original/MDXComponents';
import DesignPreview from '@site/src/components/DesignPreview';

// Register components so they're usable in any .md/.mdx page without imports.
export default {
  ...MDXComponents,
  DesignPreview,
};
