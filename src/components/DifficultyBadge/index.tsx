import React from 'react';
import styles from './styles.module.css';

const COLORS: Record<string, string> = {
  senior: 'var(--vt-blue)',
  staff: 'var(--vt-purple)',
  principal: 'var(--vt-amber)',
};

/**
 * A tinted pill showing difficulty level (senior / staff / principal).
 * Reused by DocMeta and the /problems catalog.
 */
export default function DifficultyBadge({
  level,
}: {
  level: string;
}): React.ReactElement {
  const color = COLORS[level] ?? 'var(--vt-text-muted)';
  return (
    <span
      className={styles.badge}
      style={{
        color,
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
      }}
    >
      {level}
    </span>
  );
}
