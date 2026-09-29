import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma-service.service.ts';

// One connection pool shared by every module
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
