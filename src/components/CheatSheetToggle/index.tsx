import React, {useEffect, useState, type ReactNode} from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

type View = 'full' | 'cheat';

const PARAM = 'view';
const CHEAT_VALUE = 'cheatsheet';
// A data attribute, not a class: Docusaurus/Helmet rewrites <html class> after hydration.
const MODE_ATTR = 'data-vt-view';

function readView(): View {
  return new URLSearchParams(window.location.search).get(PARAM) === CHEAT_VALUE ? 'cheat' : 'full';
}

function writeView(view: View): void {
  const url = new URL(window.location.href);
  if (view === 'cheat') url.searchParams.set(PARAM, CHEAT_VALUE);
  else url.searchParams.delete(PARAM);
  url.hash = '';
  window.history.replaceState(window.history.state, '', url);
}

/**
 * "Full design | Cheat sheet" switch placed right after a problem page's
 * lead paragraph.
 *
 * Cheat-sheet mode sets `data-vt-view="cheatsheet"` on <html>; custom.css then hides every
 * sibling *after* this component inside `.theme-doc-markdown`, plus the TOC.
 * That lets the full page stay plain Markdown — no wrapping the whole doc in
 * a component. The view is mirrored to `?view=cheatsheet` so it is linkable.
 *
 * The cheat sheet itself is an MDX partial (`_<design>.cheatsheet.md`) passed
 * as children, so the same file also renders on /reference/cheat-sheets.
 */
export default function CheatSheetToggle({children}: {readonly children: ReactNode}): React.ReactElement {
  const [view, setView] = useState<View>('full');

  useEffect(() => {
    setView(readView());
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (view === 'cheat') root.setAttribute(MODE_ATTR, 'cheatsheet');
    else root.removeAttribute(MODE_ATTR);
    return () => root.removeAttribute(MODE_ATTR);
  }, [view]);

  const select = (next: View) => {
    if (next === view) return;
    setView(next);
    writeView(next);
    window.scrollTo({top: 0});
  };

  return (
    <div className={clsx('vt-cheat-host', styles.host)}>
      <div className={styles.switch} role="tablist" aria-label="Page view">
        {(['full', 'cheat'] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            className={clsx(styles.option, view === v && styles.active)}
            onClick={() => select(v)}>
            {v === 'full' ? 'Full design' : '⚡ Cheat sheet'}
          </button>
        ))}
      </div>
      {view === 'cheat' && <div className={styles.sheet}>{children}</div>}
    </div>
  );
}
