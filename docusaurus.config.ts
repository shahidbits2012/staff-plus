import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import common from './config/site.json';
import envLocal from './config/env.local.json';
import envProd from './config/env.prod.json';

// ---------------------------------------------------------------------------
// Environment-specific configuration.
// Select with APP_ENV=local|prod (defaults to local). Hostname (`url`) and
// `baseUrl` live in config/env.*.json — the single source of truth for the
// sitemap hostname, canonical URLs, and robots.txt.
// ---------------------------------------------------------------------------
const APP_ENV = process.env.APP_ENV === 'prod' ? 'prod' : 'local';
const env = APP_ENV === 'prod' ? envProd : envLocal;
const site = {...common, ...env};

const SITEMAP_FILENAME = 'sitemap.xml';

const config: Config = {
  title: site.siteName,
  tagline: site.tagline,
  favicon: 'img/favicon.ico',

  url: site.url,
  baseUrl: site.baseUrl,

  organizationName: site.githubOwner,
  projectName: site.githubRepoName,

  // Exposed to React/MDX components via useDocusaurusContext().siteConfig.customFields
  customFields: {
    vetoraUrl: site.vetoraUrl,
  },

  onBrokenLinks: 'throw',

  markdown: {
    mermaid: true,
  },
  themes: ['@docusaurus/theme-mermaid'],

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
        sitemap: {
          changefreq: 'weekly',
          priority: 0.5,
          filename: SITEMAP_FILENAME,
          ignorePatterns: ['/tags/**'],
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    // Serves /sitemap.xml + /robots.txt on the dev server and writes robots.txt
    // at build time — hostname sourced from config/env.*.json.
    './plugins/seo-endpoints.js',
  ],

  themeConfig: {
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: site.siteName,
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'guideSidebar',
          position: 'left',
          label: 'Guide',
        },
        {
          type: 'docSidebar',
          sidebarId: 'problemsSidebar',
          position: 'left',
          label: 'Problems',
        },
        {
          type: 'docSidebar',
          sidebarId: 'referenceSidebar',
          position: 'left',
          label: 'Reference',
        },
        {
          to: '/intro',
          label: 'About',
          position: 'left',
        },
        {
          href: site.githubRepoUrl,
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Learn',
          items: [
            {label: 'System Design Method', to: '/method/framework'},
            {label: 'Problems', to: '/problems/messaging/chat-system'},
            {label: 'Reference', to: '/reference/patterns-cheatsheet'},
          ],
        },
        {
          title: 'Community',
          items: [
            {label: 'GitHub', href: site.githubRepoUrl},
            {label: 'Contribute', href: `${site.githubRepoUrl}/blob/${site.githubBranch}/CONTRIBUTING.md`},
            {label: 'Report an issue', href: `${site.githubRepoUrl}/issues`},
          ],
        },
        {
          title: 'About',
          items: [
            {label: 'How this site works', to: '/intro'},
            {label: '100% Free, Forever', to: '/intro'},
          ],
        },
      ],
      copyright: `Staff Prep · 100% free, forever · Open source · Built for the community`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['java', 'go', 'protobuf', 'sql'],
    },
    mermaid: {
      theme: {light: 'neutral', dark: 'dark'},
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
