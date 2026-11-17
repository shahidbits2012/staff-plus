import React, {useEffect, useRef, useState, useMemo} from 'react';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import styles from './styles.module.css';

interface Step {
  id: string;
  num: string;
  short: string;
  full: string;
}

const KEYWORDS: Record<string, string> = {
  requirement: 'Requirements',
  entit: 'Entities',
  'api': 'API',
  interface: 'API',
  'high-level': 'HLD',
  'deep dive': 'Deep Dives',
  bottleneck: 'Failures',
  failure: 'Failures',
  'trade-off': 'Trade-offs',
  alternative: 'Trade-offs',
  related: 'Related',
};

function shortLabel(text: string): string {
  const lower = text.toLowerCase();
  for (const [kw, label] of Object.entries(KEYWORDS)) {
    if (lower.includes(kw)) return label;
  }
  return text.length > 14 ? text.slice(0, 14) + '…' : text;
}

/**
 * Sticky chip row showing numbered h2 sections on complete problem pages.
 * Active section is tracked via passive scroll listener + rAF.
 */
export default function SectionRail(): React.ReactElement | null {
  const {frontMatter, toc} = useDoc();
  const fm = frontMatter as Record<string, unknown>;

  const steps = useMemo<Step[]>(() => {
    const h2s = toc.filter((t) => t.level === 2);
    const numbered = h2s
      .map((t) => {
        const m = t.value.match(/^(\d+)\.\s+(.+)$/);
        if (!m) return null;
        return {id: t.id, num: m[1], short: shortLabel(m[2]), full: t.value};
      })
      .filter(Boolean) as Step[];
    return numbered;
  }, [toc]);

  // Don't render for drafts, non-problem pages, or pages with < 5 numbered h2s
  const docId = (fm as Record<string, unknown>).id as string | undefined;
  const metadata = useDoc().metadata;
  const isProblem = metadata.id?.startsWith('problems/');
  const isDraft = fm.status === 'draft';

  if (!isProblem || isDraft || steps.length < 5) return null;

  return <SectionRailInner steps={steps} />;
}

function SectionRailInner({steps}: {steps: Step[]}): React.ReactElement {
  const [activeId, setActiveId] = useState(steps[0]?.id ?? '');
  const rowRef = useRef<HTMLElement>(null);
  const chipRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());

  useEffect(() => {
    // Set data attribute and CSS variable on mount
    document.documentElement.setAttribute('data-vt-rail', '');
    document.documentElement.style.setProperty('--vt-rail-height', '44px');
    return () => {
      document.documentElement.removeAttribute('data-vt-rail');
      document.documentElement.style.removeProperty('--vt-rail-height');
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const navbar = document.querySelector('.navbar');
      const navH = navbar ? navbar.getBoundingClientRect().height : 60;
      const threshold = navH + 44 + 8; // navbar + rail + gap

      let current = steps[0]?.id ?? '';
      for (const step of steps) {
        const el = document.getElementById(step.id);
        if (el && el.getBoundingClientRect().top <= threshold) {
          current = step.id;
        }
      }
      setActiveId((prev) => (prev === current ? prev : current));
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', schedule, {passive: true});
    window.addEventListener('resize', schedule, {passive: true});
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [steps]);

  // Scroll active chip into view in the row
  useEffect(() => {
    const chip = chipRefs.current.get(activeId);
    const row = rowRef.current;
    if (chip && row) {
      const chipRect = chip.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      if (chipRect.left < rowRect.left || chipRect.right > rowRect.right) {
        row.scrollTo({left: chip.offsetLeft - 16, behavior: 'smooth'});
      }
    }
  }, [activeId]);

  return (
    <nav ref={rowRef} className={styles.rail} aria-label="Design sections">
      {steps.map((step) => (
        <a
          key={step.id}
          ref={(el) => {
            if (el) chipRefs.current.set(step.id, el);
          }}
          href={`#${step.id}`}
          className={styles.chip}
          aria-current={activeId === step.id ? 'true' : undefined}
          title={step.full}
        >
          <span className={styles.num}>{step.num}</span> {step.short}
        </a>
      ))}
    </nav>
  );
}
