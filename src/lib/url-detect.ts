/**
 * Detects the type/label of a URL based on its hostname and path patterns.
 * Returns a human-readable label like "Drive Link", "Google Docs", "Figma", etc.
 */

export interface UrlDetectionResult {
  label: string;
  category: 'documentation' | 'design' | 'dev-environment' | 'dashboard' | 'other-resource';
}

const URL_PATTERNS: Array<{
  match: (hostname: string, pathname: string) => boolean;
  label: string;
  category: UrlDetectionResult['category'];
}> = [
  // Google Drive
  {
    match: (h, p) => h === 'drive.google.com',
    label: 'Drive Link',
    category: 'other-resource',
  },
  // Google Docs
  {
    match: (h, p) => h === 'docs.google.com' && p.startsWith('/document'),
    label: 'Google Docs',
    category: 'documentation',
  },
  // Google Sheets
  {
    match: (h, p) => h === 'docs.google.com' && p.startsWith('/spreadsheets'),
    label: 'Google Sheets',
    category: 'documentation',
  },
  // Google Slides
  {
    match: (h, p) => h === 'docs.google.com' && p.startsWith('/presentation'),
    label: 'Google Slides',
    category: 'documentation',
  },
  // Google Forms
  {
    match: (h, p) => h === 'docs.google.com' && p.startsWith('/forms'),
    label: 'Google Forms',
    category: 'documentation',
  },
  // Any other docs.google.com
  {
    match: (h) => h === 'docs.google.com',
    label: 'Docs Link',
    category: 'documentation',
  },
  // Figma
  {
    match: (h) => h === 'figma.com' || h.endsWith('.figma.com'),
    label: 'Figma',
    category: 'design',
  },
  // Notion
  {
    match: (h) => h === 'notion.so' || h.endsWith('.notion.so') || h === 'notion.com',
    label: 'Notion',
    category: 'documentation',
  },
  // Confluence
  {
    match: (h) => h.includes('confluence') || h.includes('atlassian.net'),
    label: 'Confluence',
    category: 'documentation',
  },
  // Jira
  {
    match: (h, p) => h.includes('atlassian.net') && p.startsWith('/jira'),
    label: 'Jira',
    category: 'other-resource',
  },
  // GitHub
  {
    match: (h) => h === 'github.com' || h.endsWith('.github.com'),
    label: 'GitHub',
    category: 'dev-environment',
  },
  // GitLab
  {
    match: (h) => h === 'gitlab.com' || h.includes('gitlab'),
    label: 'GitLab',
    category: 'dev-environment',
  },
  // Bitbucket
  {
    match: (h) => h === 'bitbucket.org',
    label: 'Bitbucket',
    category: 'dev-environment',
  },
  // Vercel
  {
    match: (h) => h === 'vercel.com' || h.endsWith('.vercel.app'),
    label: 'Vercel',
    category: 'dev-environment',
  },
  // Netlify
  {
    match: (h) => h === 'netlify.com' || h.endsWith('.netlify.app'),
    label: 'Netlify',
    category: 'dev-environment',
  },
  // Linear
  {
    match: (h) => h === 'linear.app',
    label: 'Linear',
    category: 'other-resource',
  },
  // Trello
  {
    match: (h) => h === 'trello.com',
    label: 'Trello',
    category: 'other-resource',
  },
  // Slack
  {
    match: (h) => h === 'slack.com' || h.endsWith('.slack.com'),
    label: 'Slack',
    category: 'other-resource',
  },
  // Loom
  {
    match: (h) => h === 'loom.com' || h.endsWith('.loom.com'),
    label: 'Loom Video',
    category: 'documentation',
  },
  // YouTube
  {
    match: (h) => h === 'youtube.com' || h === 'youtu.be',
    label: 'YouTube',
    category: 'other-resource',
  },
  // Miro
  {
    match: (h) => h === 'miro.com',
    label: 'Miro Board',
    category: 'design',
  },
  // Whimsical
  {
    match: (h) => h === 'whimsical.com',
    label: 'Whimsical',
    category: 'design',
  },
  // Lucidchart
  {
    match: (h) => h === 'lucid.app' || h === 'lucidchart.com',
    label: 'Lucidchart',
    category: 'design',
  },
  // Dropbox
  {
    match: (h) => h === 'dropbox.com' || h.endsWith('.dropbox.com'),
    label: 'Dropbox',
    category: 'other-resource',
  },
  // OneDrive / SharePoint
  {
    match: (h) => h.includes('sharepoint.com') || h.includes('onedrive.live.com'),
    label: 'OneDrive',
    category: 'other-resource',
  },
  // Microsoft Excel Online
  {
    match: (h, p) => h.includes('office.com') || h.includes('live.com') && p.includes('excel'),
    label: 'Excel Online',
    category: 'documentation',
  },
  // Microsoft Word Online
  {
    match: (h, p) => h.includes('office.com') || h.includes('live.com') && p.includes('word'),
    label: 'Word Online',
    category: 'documentation',
  },
  // Postman
  {
    match: (h) => h === 'postman.com' || h.endsWith('.postman.co'),
    label: 'Postman',
    category: 'dev-environment',
  },
  // Swagger / API Docs (common patterns)
  {
    match: (h, p) =>
      p.includes('/swagger') || p.includes('/api-docs') || p.includes('/openapi'),
    label: 'API Docs',
    category: 'documentation',
  },
  // Storybook (common storybook.js.org or custom /storybook paths)
  {
    match: (h, p) => h.includes('storybook') || p.includes('/storybook'),
    label: 'Storybook',
    category: 'dev-environment',
  },
  // AWS Console
  {
    match: (h) => h.includes('console.aws.amazon.com'),
    label: 'AWS Console',
    category: 'dashboard',
  },
  // GCP Console
  {
    match: (h) => h.includes('console.cloud.google.com'),
    label: 'GCP Console',
    category: 'dashboard',
  },
  // Azure Portal
  {
    match: (h) => h.includes('portal.azure.com'),
    label: 'Azure Portal',
    category: 'dashboard',
  },
  // Sentry
  {
    match: (h) => h === 'sentry.io' || h.endsWith('.sentry.io'),
    label: 'Sentry',
    category: 'dev-environment',
  },
  // Datadog
  {
    match: (h) => h === 'datadoghq.com' || h.endsWith('.datadoghq.com'),
    label: 'Datadog',
    category: 'dashboard',
  },
  // Cloudflare
  {
    match: (h) => h === 'cloudflare.com' || h.endsWith('.cloudflare.com') || h === 'dash.cloudflare.com',
    label: 'Cloudflare',
    category: 'dashboard',
  },
  // Railway
  {
    match: (h) => h === 'railway.app' || h.endsWith('.railway.app'),
    label: 'Railway',
    category: 'dev-environment',
  },
  // Render
  {
    match: (h) => h === 'render.com' || h.endsWith('.render.com') || h === 'dashboard.render.com',
    label: 'Render',
    category: 'dev-environment',
  },
  // PlanetScale
  {
    match: (h) => h === 'planetscale.com' || h.endsWith('.planetscale.com'),
    label: 'PlanetScale',
    category: 'dev-environment',
  },
  // Supabase
  {
    match: (h) => h === 'supabase.com' || h.endsWith('.supabase.co'),
    label: 'Supabase',
    category: 'dev-environment',
  },
  // Firebase
  {
    match: (h) => h.includes('firebase') || h.includes('firebaseapp.com'),
    label: 'Firebase',
    category: 'dev-environment',
  },
];

/**
 * Detects the label and category of a URL.
 * Returns null if the URL is invalid.
 */
export function detectUrlLabel(rawUrl: string): UrlDetectionResult | null {
  if (!rawUrl) return null;
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  const hostname = parsed.hostname.replace(/^www\./, '');
  const pathname = parsed.pathname;

  for (const pattern of URL_PATTERNS) {
    if (pattern.match(hostname, pathname)) {
      return { label: pattern.label, category: pattern.category };
    }
  }

  // Fallback: use the hostname capitalized
  return { label: hostname, category: 'other-resource' };
}
