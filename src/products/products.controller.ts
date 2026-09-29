import { Controller } from '@nestjs/common';
import { GrpcMethod, Payload } from '@nestjs/microservices';
import { ProductsService } from './products.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ProductByIdDto } from './dto/product-by-id.dto.js';
import { FindProductsDto } from './dto/find-products.dto.ts';
import { AdjustStockDto } from './dto/adjust-stock.dto.ts';
import { PRODUCTS_SERVICE_NAME } from '../generated/proto/products.ts';

@Controller()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) { }

  @GrpcMethod(PRODUCTS_SERVICE_NAME, 'Create')
  create(@Payload() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @GrpcMethod(PRODUCTS_SERVICE_NAME, 'FindAll')
  findAll(@Payload() findProductsDto: FindProductsDto) {
    return this.productsService.findAll(findProductsDto);
  }

  @GrpcMethod(PRODUCTS_SERVICE_NAME, 'FindOne')
  findOne(@Payload() { id }: ProductByIdDto) {
    return this.productsService.findOne(id);
  }

  @GrpcMethod(PRODUCTS_SERVICE_NAME, 'Update')
  update(@Payload() { id, ...updateProductDto }: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @GrpcMethod(PRODUCTS_SERVICE_NAME, 'Remove')
  remove(@Payload() { id }: ProductByIdDto) {
    return this.productsService.remove(id);
  }

  @GrpcMethod(PRODUCTS_SERVICE_NAME, 'AdjustStock')
  adjustStock(@Payload() adjustStockDto: AdjustStockDto) {
    return this.productsService.adjustStock(adjustStockDto);
  }
}
