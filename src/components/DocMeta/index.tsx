import React from 'react';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import {useSidebarBreadcrumbs} from '@docusaurus/plugin-content-docs/client';
import {useDocById} from '@docusaurus/plugin-content-docs/client';
import Link from '@docusaurus/Link';
import DifficultyBadge from '@site/src/components/DifficultyBadge';
import styles from './styles.module.css';

interface CustomFrontMatter {
  difficulty?: string;
  status?: string;
  concepts?: string[];
  [key: string]: unknown;
}

/** Resolves a doc id to a linked pill. Separate component so useDocById hook is called per-pill. */
function ConceptPill({id}: {id: string}): React.ReactElement | null {
  try {
    const doc = useDocById(id);
    return (
      <Link to={`/${id}`} className={styles.pill}>
        {doc.title}
      </Link>
    );
  } catch {
    return <span className={styles.pill}>{id}</span>;
  }
}

/**
 * Renders an eyebrow row (category + difficulty) and optional "Builds on" concept
 * pills above the doc content. Shows a draft note for status: draft pages.
 */
export default function DocMeta(): React.ReactElement | null {
  const {frontMatter} = useDoc();
  const fm = frontMatter as CustomFrontMatter;
  const difficulty = fm.difficulty;
  const status = fm.status;
  const concepts = fm.concepts ?? [];
  const breadcrumbs = useSidebarBreadcrumbs();

  const hasContent = difficulty || status === 'draft' || concepts.length > 0;
  if (!hasContent) return null;

  // Category label: last category breadcrumb (skipping the current page)
  const category = breadcrumbs
    ?.filter((b) => b.type === 'category')
    .pop();

  const MAX_CONCEPTS = 8;
  const shownConcepts = concepts.slice(0, MAX_CONCEPTS);
  const remaining = concepts.length - MAX_CONCEPTS;

  return (
    <div className={styles.meta}>
      {(category || difficulty) && (
        <div className={styles.eyebrow}>
          {category && <span>{category.label}</span>}
          {category && difficulty && <span className={styles.dot}>·</span>}
          {difficulty && <DifficultyBadge level={difficulty} />}
        </div>
      )}
      {status === 'draft' && (
        <p className={styles.draft} role="note">
          Draft — this page is an outline and will be expanded.
        </p>
      )}
      {shownConcepts.length > 0 && (
        <div className={styles.concepts}>
          <span className={styles.conceptsLabel}>Builds on</span>
          {shownConcepts.map((id) => (
            <ConceptPill key={id} id={id} />
          ))}
          {remaining > 0 && (
            <span className={styles.more}>+{remaining} more</span>
          )}
        </div>
      )}
    </div>
  );
}
