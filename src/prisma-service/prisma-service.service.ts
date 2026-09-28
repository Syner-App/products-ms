
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../generated/prisma/client.js';
import { envs } from '../config/envs.ts';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{

  private logger = new Logger('PrismaService')
  constructor() {
    const adapter = new PrismaBetterSqlite3({
      url: envs.databaseUrl,
    });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log(`Database connected`);
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
