import MDXComponents from '@theme-original/MDXComponents';
import TabItem from '@theme/TabItem';
import Tabs from '@theme/Tabs';
import DesignPreview from '@site/src/components/DesignPreview';
import StatGrid from '@site/src/components/StatGrid';
import CheatSheetToggle from '@site/src/components/CheatSheetToggle';
import TableWrap from '@site/src/components/TableWrap';

// Register components so they're usable in any .md/.mdx page without imports.
export default {
  ...MDXComponents,
  DesignPreview,
  StatGrid,
  CheatSheetToggle,
  Tabs,
  TabItem,
  table: TableWrap,
};
