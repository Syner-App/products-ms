import { Module } from '@nestjs/common';
import { ProductsModule } from './products/products.module.js';
import { AlertsModule } from './alerts/alerts.module.ts';


@Module({
  imports: [
    ProductsModule,
    AlertsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
