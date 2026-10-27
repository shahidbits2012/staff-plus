import React, {useEffect, useRef} from 'react';
import styles from './styles.module.css';

/**
 * Thin accent bar pinned under the navbar showing how far the reader is
 * through the article body.
 *
 * Progress is measured to the bottom of `.theme-doc-markdown`, not the page,
 * so the footer and pagination cards don't count as reading — otherwise the
 * bar stalls at ~85% when the last paragraph has been read.
 *
 * Writes `transform: scaleX()` directly to the DOM inside rAF instead of
 * setState, so scrolling never triggers React re-renders.
 */
const TARGET_SELECTOR = '.theme-doc-markdown';

export function readingFraction(target: Element, viewportHeight: number): number {
  const rect = target.getBoundingClientRect();
  // 0 when the article top is at the viewport top; 1 when its bottom reaches the viewport bottom.
  const total = rect.height - viewportHeight;
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, -rect.top / total));
}

export default function ReadingProgress(): React.ReactElement {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const target = document.querySelector(TARGET_SELECTOR);
      const bar = barRef.current;
      if (!target || !bar) return;
      bar.style.transform = `scaleX(${readingFraction(target, window.innerHeight)})`;
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, {passive: true});
    window.addEventListener('resize', schedule, {passive: true});
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className={styles.track} aria-hidden="true">
      <div ref={barRef} className={styles.bar} />
    </div>
  );
}
