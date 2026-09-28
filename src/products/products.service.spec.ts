import { Test, TestingModule } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { ProductsService } from './products.service.js';
import { PrismaService } from '../prisma-service/prisma-service.service.ts';

describe('ProductsService', () => {
  let service: ProductsService;
  const prisma = {
    product: {
      findUnique: vi.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('findOne throws a NOT_FOUND RpcException when the product does not exist', async () => {
    prisma.product.findUnique.mockResolvedValue(null);

    const error = await service.findOne(99).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RpcException);
    expect((error as RpcException).getError()).toMatchObject({ code: status.NOT_FOUND });
  });
});
