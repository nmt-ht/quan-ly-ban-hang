import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppModule } from './app.module.js';

const DEV_SECRET = 'dev-secret-change-me';

// The built Angular app (frontend/dist/frontend/browser). When it is there the API serves it too, so
// one service answers both the screens and /api — same origin, no CORS (the Render deployment).
const STATIC_DIR = resolve(process.env.STATIC_DIR ?? join(dirname(fileURLToPath(import.meta.url)), '../../frontend/dist/frontend/browser'));

async function bootstrap() {
  const production = process.env.NODE_ENV === 'production';
  if (production && (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEV_SECRET)) {
    throw new Error('JWT_SECRET chưa đặt (hoặc còn giá trị mặc định) — không khởi động ở production.');
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Behind Render's proxy: req.ip (kept in Nhật ký hoạt động) is the visitor, not the proxy.
  app.set('trust proxy', 1);
  if (process.env.CORS_ORIGIN) app.enableCors({ origin: process.env.CORS_ORIGIN.split(','), credentials: true });
  else if (!production) app.enableCors({ origin: true, credentials: true });
  // Logo and product photos travel as data: URLs until file uploads exist (Express defaults to 100 kB).
  app.useBodyParser('json', { limit: '10mb' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');

  if (existsSync(join(STATIC_DIR, 'index.html'))) {
    // Hashed bundles are cached for a year; index.html never, so a deploy shows up on the next load.
    app.useStaticAssets(STATIC_DIR, {
      index: false,
      maxAge: '1y',
      setHeaders: (res, path) => {
        if (path.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
      },
    });
    // Client-side routes (/don-hang/dh-14…) all load index.html; /api stays with Nest.
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' || req.path === '/api' || req.path.startsWith('/api/')) return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(join(STATIC_DIR, 'index.html'));
    });
  }

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
