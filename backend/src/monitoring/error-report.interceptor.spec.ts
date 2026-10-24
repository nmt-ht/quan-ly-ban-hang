import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { isServerFault } from './error-report.interceptor.js';

describe('isServerFault', () => {
  it('reports 5xx and unexpected errors, not user mistakes', () => {
    expect(isServerFault(new Error('boom'))).toBe(true);
    expect(isServerFault(new InternalServerErrorException())).toBe(true);
    expect(isServerFault(new BadRequestException('x'))).toBe(false);
    expect(isServerFault(Object.assign(new Error('dup'), { code: 'P2002' }))).toBe(false);
    expect(isServerFault(Object.assign(new Error('other'), { code: 'P2034' }))).toBe(true);
  });
});
