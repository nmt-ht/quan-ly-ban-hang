import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The backend folder (package.json, prisma/, node_modules/), from src/platform or dist/platform alike.
export const BACKEND_ROOT = resolve(process.env.BACKEND_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), '../..'));

/** Newest migration this build carries: a doanh nghiệp whose database is behind it needs "Cập nhật cấu trúc". */
export function latestMigration(): string | null {
  try {
    const names = readdirSync(join(BACKEND_ROOT, 'prisma/migrations'), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    return names.at(-1) ?? null;
  } catch {
    return null;
  }
}

export interface CommandResult {
  ok: boolean;
  output: string;
}

/**
 * Runs a backend script against one doanh nghiệp's database: node itself (no shell, no npx), DATABASE_URL
 * pointed at that database, extra variables on top. The output is kept for the error shown on the page.
 */
function runNode(args: string[], env: Record<string, string>, timeoutMs = 10 * 60_000): Promise<CommandResult> {
  return new Promise((done) => {
    const child = spawn(process.execPath, args, { cwd: BACKEND_ROOT, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const keep = (chunk: Buffer) => {
      output = (output + chunk.toString('utf8')).slice(-8000);
    };
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.on('error', (err) => {
      clearTimeout(timer);
      done({ ok: false, output: `${output}\n${err.message}` });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      done({ ok: code === 0, output });
    });
  });
}

/** `prisma migrate deploy`: applies the migrations the database has not had yet. Safe to repeat. */
export function migrateDeploy(databaseUrl: string): Promise<CommandResult> {
  return runNode([join(BACKEND_ROOT, 'node_modules/prisma/build/index.js'), 'migrate', 'deploy'], { DATABASE_URL: databaseUrl });
}

/** A TypeScript script under prisma/ (seed.ts, seed-demo.ts), run through tsx. */
export function runScript(script: string, env: Record<string, string>): Promise<CommandResult> {
  return runNode(['--import', 'tsx', join(BACKEND_ROOT, script)], env);
}

/** The useful end of a failed command's output: the last lines, without connection strings. */
export function errorTail(output: string): string {
  return output
    .replace(/postgres(ql)?:\/\/[^\s'"]+/g, '(chuỗi kết nối)')
    .trim()
    .split('\n')
    .slice(-12)
    .join('\n');
}
