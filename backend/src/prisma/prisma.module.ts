import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import { SequenceController } from './sequence.controller.js';
import { SequenceService } from './sequence.service.js';

@Global()
@Module({
  controllers: [SequenceController],
  providers: [PrismaService, SequenceService],
  exports: [PrismaService, SequenceService],
})
export class PrismaModule {}
