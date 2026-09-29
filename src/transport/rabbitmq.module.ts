import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { envs, PRODUCTS_EVENTS_CLIENT, SYNER_EXCHANGE } from '../config/index.ts';

const rabbitMQClients = ClientsModule.register([
  {
    name: PRODUCTS_EVENTS_CLIENT,
    transport: Transport.RMQ,
    options: {
      urls: [envs.rabbitmqUrl],
      exchange: SYNER_EXCHANGE,
      exchangeType: 'topic',
      // Publish to the exchange using the event pattern as routing key
      wildcards: true,
      persistent: true,
    },
  },
]);

@Module({
  imports: [rabbitMQClients],
  exports: [rabbitMQClients],
})
export class RabbitMQModule {}
