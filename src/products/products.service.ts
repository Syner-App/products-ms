import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { PrismaService } from '../prisma-service/prisma-service.service.ts';
import { PaginationDto } from '../common/index.ts';

@Injectable()
export class ProductsService {

  constructor(private prisma: PrismaService) { }

  async create(createProductDto: CreateProductDto) {
    const product = await this.prisma.product.create({
      data: createProductDto,
    })
    return product;
  }

  async findAll(paginationDto: PaginationDto) {
    const { page, limit } = paginationDto;

    const totalPage = await this.prisma.product.count({ where: { available: true } });

    const lastPage = Math.ceil( totalPage / limit!  );


    return {
      data: await this.prisma.product.findMany({
        where: { available: true },
        take: limit,
        skip: (page! - 1) * limit!,
      }),
      meta: {
        total: totalPage,
        page: page,
        lastPage: lastPage

      }
    }
  }

  async findOne(id: number) {
    const product = await this.prisma.product.findUnique({ where: { id: id, available: true } });

    if (!product) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Product with id: #${id} not found`,
      });
    }

    return product;
  }

  async update(id: number, updateProductDto: Omit<UpdateProductDto, 'id'>) {
    await this.findOne(id);

    return await this.prisma.product.update({
      where: { id },
      data: updateProductDto,
    })
  }

  // async remove(id: number) {
  //   await this.findOne(id);
  //   return this.prisma.product.delete({ where: { id } });
  // }

  async remove(id: number) {
    await this.findOne(id);

    const product = await this.prisma.product.update({
      where: { id },
      data: {  available: false, }
    });

    return product;
  }
}
