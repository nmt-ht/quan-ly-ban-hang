import { createHash } from 'node:crypto';
import type { HelmetOptions } from 'helmet';

/** CSP source `'sha256-…'` for every inline <script> in an HTML document. */
export function inlineScriptHashes(html: string): string[] {
  const hashes: string[] = [];
  for (const m of html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (m[1].trim()) hashes.push(`'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`);
  }
  return hashes;
}

/**
 * Security headers for the API and the Angular app it serves. The only inline script is the one the
 * Angular build adds to switch critical CSS on (index.html), so it is allowed by hash, computed from the
 * built file at start-up: a rebuild never leaves the screens unstyled. Everything else is same-origin.
 * `data:` images carry logos and product photos until they move to object storage.
 */
export function helmetOptions(indexHtml?: string): HelmetOptions {
  return {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'", ...(indexHtml ? inlineScriptHashes(indexHtml) : [])],
        'style-src': ["'self'", "'unsafe-inline'"], // Angular component styles are inline
        'img-src': ["'self'", 'data:', 'blob:'],
        'font-src': ["'self'", 'data:'],
        'connect-src': ["'self'"],
        'worker-src': ["'self'", 'blob:'],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    // HSTS only means something over HTTPS (Render terminates TLS in front of the app).
    strictTransportSecurity: process.env.NODE_ENV === 'production' ? { maxAge: 15552000, includeSubDomains: true } : false,
  };
}
