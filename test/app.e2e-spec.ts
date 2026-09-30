import { Test, TestingModule } from '@nestjs/testing';
import { INestMicroservice } from '@nestjs/common';
import { ClientGrpc, ClientsModule, Transport } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { join } from 'path';
import { firstValueFrom } from 'rxjs';
import { AppModule } from './../src/app.module.js';
import {
  PRODUCTS_PACKAGE_NAME,
  PRODUCTS_SERVICE_NAME,
  ProductsServiceClient,
} from './../src/generated/proto/products.ts';

const grpcOptions = {
  package: PRODUCTS_PACKAGE_NAME,
  protoPath: join(import.meta.dirname, '../src/proto/products.proto'),
  url: 'localhost:50099',
  loader: { keepCase: true, enums: String },
};

// Any organization id: rows are scoped to it (an unknown organization just has no products)
const organization_id = '6abd26a42d059ac027376ca1';

describe('ProductsService (gRPC e2e)', () => {
  let app: INestMicroservice;
  let productsClient: ProductsServiceClient;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        AppModule,
        ClientsModule.register([
          { name: 'PRODUCTS_CLIENT', transport: Transport.GRPC, options: grpcOptions },
        ]),
      ],
    }).compile();

    app = moduleFixture.createNestMicroservice({
      transport: Transport.GRPC,
      options: grpcOptions,
    });
    await app.listen();

    const client = app.get<ClientGrpc>('PRODUCTS_CLIENT');
    productsClient = client.getService<ProductsServiceClient>(PRODUCTS_SERVICE_NAME);
  });

  afterAll(async () => {
    await app.close();
  });

  it('FindAll returns a paginated product list', async () => {
    const result = await firstValueFrom(productsClient.findAll({ organization_id, page: 1, limit: 5 }));

    expect(result.data.length).toBeLessThanOrEqual(5);
    expect(result.meta).toMatchObject({ page: 1 });
  });

  it('FindOne returns NOT_FOUND for a missing product', async () => {
    await expect(firstValueFrom(productsClient.findOne({ organization_id, id: 999999 }))).rejects.toMatchObject({
      code: status.NOT_FOUND,
    });
  });
});
