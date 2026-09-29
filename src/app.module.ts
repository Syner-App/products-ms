import { Module } from '@nestjs/common';
import { ProductsModule } from './products/products.module.js';
import { AlertsModule } from './alerts/alerts.module.ts';
import { PrismaModule } from './prisma-service/prisma.module.ts';


@Module({
  imports: [
    PrismaModule,
    ProductsModule,
    AlertsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
