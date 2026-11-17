import React from 'react';
import Content from '@theme-original/DocItem/Content';
import type ContentType from '@theme/DocItem/Content';
import type {WrapperProps} from '@docusaurus/types';
import DocMeta from '@site/src/components/DocMeta';
import SectionRail from '@site/src/components/SectionRail';

type Props = WrapperProps<typeof ContentType>;

/**
 * Wraps the stock doc content to add the sticky section rail (SectionRail)
 * and page metadata header (DocMeta) above the article body.
 */
export default function ContentWrapper(props: Props): React.ReactElement {
  return (
    <>
      <SectionRail />
      <DocMeta />
      <Content {...props} />
    </>
  );
}
