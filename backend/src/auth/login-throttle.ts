import { ThrottlerModuleOptions } from '@nestjs/throttler';

const num = (name: string, fallback: number) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const who = (req: Record<string, any>): string => String(req.body?.email ?? req.user?.id ?? '').trim().toLowerCase();

/**
 * Brute-force brake for the sign-in and change-password routes (only those use ThrottlerGuard):
 *  - `ip`: one address may try 30 times per 5 minutes, whatever accounts it tries;
 *  - `account`: 8 tries per 15 minutes for one account from one address.
 * Limits can be tuned with LOGIN_LIMIT_IP / LOGIN_LIMIT_ACCOUNT. Off while NODE_ENV=test unless
 * E2E_THROTTLE is set, so the e2e suites (which sign in many times) are not throttled.
 */
export const loginThrottle = (): ThrottlerModuleOptions => ({
  errorMessage: 'Thử đăng nhập quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.',
  skipIf: () => process.env.NODE_ENV === 'test' && !process.env.E2E_THROTTLE,
  throttlers: [
    { name: 'ip', ttl: 5 * 60_000, limit: () => num('LOGIN_LIMIT_IP', 30), getTracker: (req) => String(req.ip) },
    { name: 'account', ttl: 15 * 60_000, limit: () => num('LOGIN_LIMIT_ACCOUNT', 8), getTracker: (req) => `${req.ip}|${who(req)}` },
  ],
});
