import { createHash } from 'node:crypto';
import { helmetOptions, inlineScriptHashes } from './security.js';

const SCRIPT = "document.querySelectorAll('link[data-beasties-media]').forEach(function(l){l.media='all'})";
const HTML = `<html><body><app-root></app-root><script src="main.js" type="module"></script><script>${SCRIPT}</script></body></html>`;

describe('security headers', () => {
  it('hashes inline scripts only, not <script src>', () => {
    const expected = `'sha256-${createHash('sha256').update(SCRIPT).digest('base64')}'`;
    expect(inlineScriptHashes(HTML)).toEqual([expected]);
    expect(inlineScriptHashes('<script src="a.js"></script>')).toEqual([]);
  });

  it('puts the hash in script-src and keeps framing and plugins off', () => {
    const csp = helmetOptions(HTML).contentSecurityPolicy;
    const d = (csp as { directives: Record<string, string[]> }).directives;
    expect(d['script-src']).toHaveLength(2);
    expect(d['script-src']).not.toContain("'unsafe-inline'");
    expect(d['frame-ancestors']).toEqual(["'none'"]);
    expect(d['object-src']).toEqual(["'none'"]);
  });
});
