import React from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

type Props = {
  /** Design file name under /designs (e.g. "chat-system.vetora.yaml"). */
  file: string;
  /** iframe height in px. */
  height?: number;
  /** Accessible iframe title. */
  title?: string;
};

/**
 * Renders a Vetora design preview for a design YAML hosted on this site.
 *
 * Hostnames are read from config (never hardcoded):
 *   - Staff Prep host  → siteConfig.url        (where the .yaml is served)
 *   - Vetora host      → customFields.vetoraUrl (the /preview renderer)
 *
 * Final URL: {vetoraUrl}/preview?url={staffPlusHost}{baseUrl}designs/{file}&tab=true
 */
export default function DesignPreview({
  file,
  height = 600,
  title = 'Design Preview',
}: Props): JSX.Element {
  const {siteConfig} = useDocusaurusContext();
  const vetoraUrl = ((siteConfig.customFields?.vetoraUrl as string) || '').replace(
    /\/+$/,
    '',
  );
  const host = siteConfig.url.replace(/\/+$/, '');
  const base = siteConfig.baseUrl.endsWith('/')
    ? siteConfig.baseUrl
    : `${siteConfig.baseUrl}/`;

  const designUrl = `${host}${base}designs/${file}`;
  const previewUrl = `${vetoraUrl}/preview?url=${encodeURIComponent(designUrl)}&tab=true`;

  return (
    <div>
      <iframe
        src={previewUrl}
        width="100%"
        height={height}
        title={title}
        style={{border: '1px solid #333', borderRadius: '8px'}}
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
        allowFullScreen
      />
      <p>
        <a href={previewUrl} target="_blank" rel="noopener noreferrer">
          Open design preview in new tab ↗
        </a>
      </p>
    </div>
  );
}
