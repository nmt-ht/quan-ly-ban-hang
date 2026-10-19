// Prisma 7 config: replaces `url` in schema.prisma and the package.json
// "prisma" block. Prisma 7 no longer reads .env on its own, hence dotenv.
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
