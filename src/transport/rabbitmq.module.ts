import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ALERTS_CLIENT, ALERTS_QUEUE, envs, PRODUCTS_EVENTS_CLIENT, SYNER_EXCHANGE } from '../config/index.ts';

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
  {
    // Request/reply straight to the alerts queue (no exchange); queueOptions
    // must match syner/rabbitmq/definitions.json
    name: ALERTS_CLIENT,
    transport: Transport.RMQ,
    options: {
      urls: [envs.rabbitmqUrl],
      queue: ALERTS_QUEUE,
      queueOptions: { durable: true },
    },
  },
]);

@Module({
  imports: [rabbitMQClients],
  exports: [rabbitMQClients],
})
export class RabbitMQModule {}
