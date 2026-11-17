import React, {useEffect, useRef, useState} from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

/**
 * Wraps Markdown tables in a horizontally scrollable region with rounded-card
 * styling. On narrow screens, wide tables scroll inside this wrapper instead of
 * overflowing the page. A CSS-only scroll shadow signals hidden content.
 *
 * Landmarks (role="region", tabIndex, aria-label) are added only while the
 * table actually overflows, keeping the landmark list clean for screen readers.
 *
 * Registered as the `table` MDX component in src/theme/MDXComponents.tsx so
 * every Markdown table is wrapped automatically.
 */
export default function TableWrap(
  props: React.ComponentPropsWithoutRef<'table'>,
): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const check = () => setScrollable(el.scrollWidth > el.clientWidth);
    check();

    const ro = new ResizeObserver(check);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={clsx('vt-table-wrap', styles.wrap)}
      {...(scrollable && {
        role: 'region',
        'aria-label': 'Table',
        tabIndex: 0,
      })}
    >
      <table {...props} />
    </div>
  );
}
