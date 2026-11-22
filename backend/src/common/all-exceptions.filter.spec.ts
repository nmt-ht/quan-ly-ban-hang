import { ArgumentsHost } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AllExceptionsFilter, SYSTEM_ERROR_MESSAGE } from './all-exceptions.filter.js';

function fake(id = 'req-1234abcd') {
  const sent: { status?: number; body?: unknown } = {};
  const res = { status: (n: number) => { sent.status = n; return { json: (b: unknown) => { sent.body = b; } }; } };
  const host = { getType: () => 'http', switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({ id, method: 'POST', originalUrl: '/api/x' }) }) } as unknown as ArgumentsHost;
  return { sent, host };
}

describe('Trả lời lỗi của máy chủ', () => {
  it('lỗi không lường trước: 500, câu tiếng Việt chung và mã yêu cầu, không lộ chi tiết', () => {
    const { sent, host } = fake();
    new AllExceptionsFilter().catch(new Error('connect ECONNREFUSED 10.0.0.5:5432 password=secret'), host);
    expect(sent.status).toBe(500);
    expect(sent.body).toEqual({ statusCode: 500, message: SYSTEM_ERROR_MESSAGE, error: 'Internal Server Error', requestId: 'req-1234abcd' });
    expect(JSON.stringify(sent.body)).not.toContain('secret');
  });

  it('lỗi ném ra không phải Error (chuỗi, đối tượng): vẫn 500 gọn gàng', () => {
    const { sent, host } = fake();
    new AllExceptionsFilter().catch('boom', host);
    expect(sent.status).toBe(500);
    new AllExceptionsFilter().catch({ weird: true }, fake().host);
  });

  it('lỗi do người dùng gây ra (trùng khoá, thiếu bản ghi) vẫn thành 409 / 404 kèm mã yêu cầu', () => {
    const { sent, host } = fake();
    const dup = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test', meta: { target: ['code'] } });
    new AllExceptionsFilter().catch(dup, host);
    expect(sent.status).toBe(409);
    expect(sent.body).toMatchObject({ statusCode: 409, message: 'Dữ liệu bị trùng (code).', requestId: 'req-1234abcd' });

    const gone = fake();
    new AllExceptionsFilter().catch(new Prisma.PrismaClientKnownRequestError('x', { code: 'P2025', clientVersion: 'test' }), gone.host);
    expect(gone.sent.status).toBe(404);
  });
});
