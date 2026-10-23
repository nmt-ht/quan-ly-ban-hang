import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // The suites share one database (and `prisma dev` serves one connection): run files one after another.
    fileParallelism: false,
    // Fails a file whose API writes left no Nhật ký line (see test/audit-coverage.setup.ts).
    setupFiles: ['./test/audit-coverage.setup.ts'],
  },
});
