import React from 'react';
import Layout from '@theme-original/DocItem/Layout';
import type LayoutType from '@theme/DocItem/Layout';
import type {WrapperProps} from '@docusaurus/types';
import ReadingProgress from '@site/src/components/ReadingProgress';

type Props = WrapperProps<typeof LayoutType>;

/**
 * Wraps the stock doc layout (no logic copied) to add the Vetora-blog
 * reading-progress bar and a soft gradient glow behind the page header.
 */
export default function LayoutWrapper(props: Props): React.ReactElement {
  return (
    <>
      <ReadingProgress />
      <div className="vt-doc-layout">
        <div className="vt-doc-glow" aria-hidden="true" />
        <Layout {...props} />
      </div>
    </>
  );
}
