import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { SequenceService } from './sequence.service.js';

/** The form of a new chứng từ shows the number it will probably get ("dự kiến"); the real number is cut when it is saved. */
@UseGuards(JwtAuthGuard)
@Controller('sequences')
export class SequenceController {
  constructor(private readonly sequences: SequenceService) {}

  @Get('next')
  async next(@Query('prefix') prefix?: string) {
    if (!prefix || !SequenceService.PREFIXES.includes(prefix)) throw new BadRequestException('Loại số chứng từ không hợp lệ');
    return { code: await this.sequences.peekCode(prefix) };
  }
}
