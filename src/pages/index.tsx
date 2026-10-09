import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import site from '@site/config/site.json';

import styles from './index.module.css';

const GITHUB_URL = site.githubRepoUrl;

function Badge({children}: {children: ReactNode}) {
  return <span className={styles.badge}>{children}</span>;
}

function Hero() {
  return (
    <header className={styles.hero}>
      <div className={styles.heroGlow} aria-hidden />
      <div className={clsx('container', styles.heroInner)}>
        <div className={styles.badgeRow}>
          <Badge>★ 100% Free — Forever</Badge>
          <Badge>Open Source</Badge>
          <Badge>Community-Driven</Badge>
        </div>

        <Heading as="h1" className={styles.heroTitle}>
          Staff Prep
        </Heading>

        <p className={styles.heroSubtitle}>
          A free, open handbook for <strong>Staff+ engineering interviews</strong>.
          System Design and DSA — taught through <em>why, how, trade-offs, and
          failure modes</em>, not flashcards.
        </p>

        <div className={styles.ctaRow}>
          <Link
            className={clsx(styles.btn, styles.btnPrimary)}
            to="/problems/messaging/chat-system">
            Explore System Design →
          </Link>
          <Link
            className={clsx(styles.btn, styles.btnGhost)}
            to="/intro">
            How this site works
          </Link>
          <Link
            className={clsx(styles.btn, styles.btnOutline)}
            href={GITHUB_URL}>
            ★ Star on GitHub
          </Link>
        </div>

        <p className={styles.heroFootnote}>
          No paywalls · No sign-up · No ads — just engineering depth.
        </p>
      </div>
    </header>
  );
}

const valueProps = [
  {
    icon: '🧠',
    title: 'Staff+ Depth',
    body: 'Every page answers why, how, trade-offs, and failure modes — the reasoning interviewers actually probe at the senior level.',
  },
  {
    icon: '🆓',
    title: 'Lifetime Free',
    body: 'All content is free forever. No premium tier, no locked chapters, no "upgrade to continue." Knowledge should not be gated.',
  },
  {
    icon: '🌍',
    title: 'Open & Community-Built',
    body: 'A public Git repository anyone can read, fork, and improve. Found a gap or a better trade-off? Open a PR.',
  },
  {
    icon: '🧩',
    title: 'Link, Don\u2019t Repeat',
    body: 'Reusable concepts live on their own pages and are cross-linked — so you learn the building blocks once and reuse them everywhere.',
  },
];

function ValueProps() {
  return (
    <section className={styles.section}>
      <div className="container">
        <div className={styles.grid}>
          {valueProps.map((v) => (
            <div key={v.title} className={styles.card}>
              <div className={styles.cardIcon}>{v.icon}</div>
              <Heading as="h3" className={styles.cardTitle}>
                {v.title}
              </Heading>
              <p className={styles.cardBody}>{v.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const tracks = [
  {
    status: 'available',
    tag: 'Available',
    title: 'System Design',
    body: 'Real problems — chat systems, feeds, rate limiters — each with requirements, HLD, deep dives per NFR, bottlenecks, and a trade-off summary.',
    link: '/problems/messaging/chat-system',
    cta: 'Start with the Chat System',
  },
  {
    status: 'available',
    tag: 'Available',
    title: 'Concepts & Building Blocks',
    body: 'Kafka, Redis, Cassandra, API gateways, consistent hashing, circuit breakers — the reusable primitives behind every design.',
    link: '/building-blocks/kafka',
    cta: 'Browse building blocks',
  },
  {
    status: 'soon',
    tag: 'Coming Soon',
    title: 'Data Structures & Algorithms',
    body: 'Pattern-first DSA for Staff+ loops — not grinding 500 problems, but the handful of patterns and the judgment to apply them under pressure.',
    link: '/intro',
    cta: 'In progress',
  },
  {
    status: 'available',
    tag: 'Reference',
    title: 'Quick Reference',
    body: 'Cheat sheets for patterns, decisions, failure modes, and scaling math — for the night before, or mid-interview recall.',
    link: '/reference/patterns-cheatsheet',
    cta: 'Open the cheat sheets',
  },
];

function Tracks() {
  return (
    <section className={clsx(styles.section, styles.sectionAlt)}>
      <div className="container">
        <Heading as="h2" className={styles.sectionTitle}>
          What&rsquo;s inside
        </Heading>
        <p className={styles.sectionLead}>
          Two tracks, one philosophy: understand the fundamentals deeply enough
          to reason from first principles.
        </p>
        <div className={styles.trackGrid}>
          {tracks.map((t) => (
            <Link
              key={t.title}
              to={t.link}
              className={clsx(
                styles.track,
                t.status === 'soon' && styles.trackSoon,
              )}>
              <span
                className={clsx(
                  styles.trackTag,
                  t.status === 'soon' && styles.trackTagSoon,
                )}>
                {t.tag}
              </span>
              <Heading as="h3" className={styles.trackTitle}>
                {t.title}
              </Heading>
              <p className={styles.trackBody}>{t.body}</p>
              <span className={styles.trackCta}>{t.cta} →</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function CommunityBand() {
  return (
    <section className={styles.community}>
      <div className={clsx('container', styles.communityInner)}>
        <Heading as="h2" className={styles.communityTitle}>
          Free knowledge, built in the open
        </Heading>
        <p className={styles.communityLead}>
          Staff Prep is and always will be 100% free. It&rsquo;s a public,
          open-source project — maintained in the open and improved by the
          community. Learn from it, share it, and contribute back.
        </p>
        <div className={styles.ctaRow}>
          <Link
            className={clsx(styles.btn, styles.btnPrimary)}
            href={GITHUB_URL}>
            ★ Star the repo
          </Link>
          <Link
            className={clsx(styles.btn, styles.btnOutline)}
            href={`${GITHUB_URL}/blob/main/CONTRIBUTING.md`}>
            Contribute a page
          </Link>
        </div>
        <div className={styles.pillRow}>
          <span className={styles.pill}>MIT-style open content</span>
          <span className={styles.pill}>No tracking</span>
          <span className={styles.pill}>No ads</span>
          <span className={styles.pill}>Forever free</span>
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout
      title="Staff Prep — Free System Design & DSA Prep"
      description="A free, open-source handbook for Staff+ engineering interviews. System Design and DSA taught through trade-offs and failure modes. 100% free, forever.">
      <Hero />
      <main>
        <ValueProps />
        <Tracks />
        <CommunityBand />
      </main>
    </Layout>
  );
}
