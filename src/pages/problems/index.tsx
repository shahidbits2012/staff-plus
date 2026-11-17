import React, {useState} from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import {usePluginData} from '@docusaurus/useGlobalData';
import DifficultyBadge from '@site/src/components/DifficultyBadge';
import styles from './styles.module.css';

interface Problem {
  id: string;
  title: string;
  permalink: string;
  summary: string;
  status: string;
  difficulty: string | null;
  category: string;
}

interface Category {
  dir: string;
  label: string;
  description: string;
}

interface PluginData {
  problems: Problem[];
  categories: Category[];
}

const FILTERS = ['all', 'senior', 'staff', 'principal'] as const;

export default function ProblemsIndex(): React.ReactElement {
  const {problems, categories} = usePluginData('content-index') as PluginData;
  const [filter, setFilter] = useState<string>('all');

  const filtered = filter === 'all'
    ? problems
    : problems.filter((p) => p.difficulty === filter);

  return (
    <Layout title="System Design Problems" description="Explore system design problems with deep-dive trade-off analysis.">
      <main className={styles.main}>
        <h1 className={styles.title}>System Design Problems</h1>
        <p className={styles.lead}>
          Each problem follows a 10-step template: requirements, entities, API, HLD, deep dives per NFR, bottlenecks, trade-offs, and related concepts.
        </p>

        <div className={styles.filters} role="group" aria-label="Filter by difficulty">
          {FILTERS.map((f) => (
            <button
              key={f}
              className={styles.chip}
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {categories.map((cat) => {
          const items = filtered
            .filter((p) => p.category === cat.dir)
            .sort((a, b) => {
              if (a.status === 'draft' && b.status !== 'draft') return 1;
              if (a.status !== 'draft' && b.status === 'draft') return -1;
              return 0;
            });
          if (items.length === 0) return null;
          return (
            <section key={cat.dir} className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>{cat.label}</h2>
                <span className={styles.count}>{items.length}</span>
                <Link to={`/problems/${cat.dir}`} className={styles.viewAll}>
                  View category →
                </Link>
              </div>
              <div className={styles.grid}>
                {items.map((p) => (
                  <Link key={p.id} to={p.permalink} className={styles.card}>
                    <div className={styles.cardHeader}>
                      <span className={styles.cardTitle}>{p.title}</span>
                      {p.difficulty && <DifficultyBadge level={p.difficulty} />}
                    </div>
                    <p className={styles.cardSummary}>{p.summary}</p>
                    {p.status === 'draft' && (
                      <span className={styles.soonPill}>Soon</span>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </Layout>
  );
}
