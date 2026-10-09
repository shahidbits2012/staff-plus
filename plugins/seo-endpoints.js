/**
 * seo-endpoints plugin
 *
 * - Build:  writes robots.txt pointing at the configured sitemap hostname
 *           (the sitemap.xml itself is produced by @docusaurus/plugin-sitemap).
 * - Dev:    the dev server (docusaurus start) does NOT run the sitemap plugin,
 *           so /sitemap.xml and /robots.txt 404. This plugin adds dev-server
 *           middleware that generates both live from the route manifest
 *           (.docusaurus/routes.js), using the hostname from config — so the
 *           same URLs work on the dev port as on a built/served site.
 *
 * Hostname is read from context.siteConfig.url/baseUrl, which already reflect
 * the selected APP_ENV (see config/env.*.json).
 */
const fs = require('fs');
const path = require('path');

function joinUrl(host, baseUrl, rel) {
  const h = host.replace(/\/+$/, '');
  const b = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${h}${b}${rel.replace(/^\//, '')}`.replace(/([^:]\/)\/+/g, '$1');
}

function buildRobots(siteConfig) {
  const sitemapUrl = joinUrl(siteConfig.url, siteConfig.baseUrl, 'sitemap.xml');
  return `User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl}\n`;
}

function readRoutePaths(siteDir) {
  const routesFile = path.join(siteDir, '.docusaurus', 'routes.js');
  const set = new Set();
  try {
    const src = fs.readFileSync(routesFile, 'utf8');
    const re = /path:\s*'([^']*)'/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      const p = m[1];
      if (p === '*') continue; // catch-all / 404
      if (p.startsWith('/__docusaurus')) continue; // debug routes
      set.add(p);
    }
  } catch (_) {
    // routes not generated yet; return what we have
  }
  return [...set].sort();
}

function buildSitemapXml(siteDir, siteConfig) {
  const urls = readRoutePaths(siteDir)
    .map((p) => {
      const loc = joinUrl(siteConfig.url, siteConfig.baseUrl, p);
      return `<url><loc>${loc}</loc><changefreq>weekly</changefreq><priority>0.5</priority></url>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}

module.exports = function seoEndpoints(context) {
  const {siteConfig, siteDir} = context;

  return {
    name: 'seo-endpoints',

    // Production build: emit robots.txt from the configured hostname.
    async postBuild({outDir}) {
      fs.writeFileSync(path.join(outDir, 'robots.txt'), buildRobots(siteConfig));
    },

    // Dev server: serve /sitemap.xml and /robots.txt live.
    configureWebpack(_config, isServer) {
      if (isServer) {
        return {};
      }
      return {
        devServer: {
          setupMiddlewares(middlewares, devServer) {
            // Preserve Docusaurus' own error-overlay source-map middleware,
            // which our setupMiddlewares would otherwise replace.
            try {
              const evalSourceMapMiddleware = require('@docusaurus/core/lib/commands/utils/legacy/evalSourceMapMiddleware').default;
              middlewares.unshift(evalSourceMapMiddleware(devServer));
            } catch (_) {
              try {
                const evalSourceMapMiddleware = require('@docusaurus/core/lib/commands/start/utils/legacy/evalSourceMapMiddleware').default;
                middlewares.unshift(evalSourceMapMiddleware(devServer));
              } catch (_) {
                /* best effort */
              }
            }

            // Run our routes BEFORE historyApiFallback so they aren't rewritten
            // to index.html.
            middlewares.unshift({
              name: 'seo-sitemap',
              path: '/sitemap.xml',
              middleware: (_req, res) => {
                res.setHeader('Content-Type', 'application/xml; charset=utf-8');
                res.end(buildSitemapXml(siteDir, siteConfig));
              },
            });
            middlewares.unshift({
              name: 'seo-robots',
              path: '/robots.txt',
              middleware: (_req, res) => {
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                res.end(buildRobots(siteConfig));
              },
            });

            return middlewares;
          },
        },
      };
    },
  };
};
