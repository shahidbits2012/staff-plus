import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

export type StatAccent = 'blue' | 'purple' | 'green' | 'amber' | 'red' | 'cyan';

export interface StatItem {
  readonly value: string;
  readonly label: string;
  readonly detail?: string;
  readonly accent?: StatAccent;
}

const ROTATION: readonly StatAccent[] = ['blue', 'purple', 'green', 'amber'];

/**
 * Headline numbers as tinted cards (2 columns on mobile, up to 4 on desktop).
 *
 * Usage in any .md page (registered globally in src/theme/MDXComponents.tsx):
 *
 *   <StatGrid stats={[
 *     {value: '100B', label: 'Messages / day', accent: 'blue'},
 *     {value: '~2.3M/s', label: 'Peak send QPS', detail: '2x average'},
 *   ]} />
 *
 * Accent defaults rotate blue → purple → green → amber.
 */
export default function StatGrid({stats}: {readonly stats: readonly StatItem[]}): React.ReactElement {
  return (
    <div className={styles.grid}>
      {stats.map((s, i) => (
        <div key={s.label} className={clsx(styles.card, styles[s.accent ?? ROTATION[i % ROTATION.length]])}>
          <div className={styles.value}>{s.value}</div>
          <div className={styles.label}>{s.label}</div>
          {s.detail && <div className={styles.detail}>{s.detail}</div>}
        </div>
      ))}
    </div>
  );
}
