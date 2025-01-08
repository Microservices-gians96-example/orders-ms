import { HttpStatus, Injectable, Logger, NotImplementedException, OnModuleInit } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { PrismaClient } from '@prisma/client';
import { RpcException } from '@nestjs/microservices';
import { OrderPaginationDto } from './dto/order-pagination.dto';
import { ChangeOrderStatusDto } from './dto';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger('OrdersService');

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to database OrdersService');
  }
  create(createOrderDto: CreateOrderDto) {
    return this.order.create({ data: createOrderDto });
  }

  async findAll(orderPaginationDto: OrderPaginationDto) {

    const totalPages = await this.order.count({
      where: { status: orderPaginationDto.status },
    });
    const currentPage = orderPaginationDto.page;
    const perPage = orderPaginationDto.limit;
    const lastPage = Math.ceil(totalPages / orderPaginationDto.limit);

    return {
      data: await this.order.findMany({
        skip: (currentPage - 1) * perPage,
        take: perPage,
        where: { status: orderPaginationDto.status },
      }),
      meta: {
        total: totalPages,
        page: currentPage,
        lastPage: lastPage
      }
    }
  }

  async findOne(id: string) {
    const order = await this.order.findFirst({
      where: { id: id, },
    });
    if (!order) {
      throw new RpcException({
        message: `order ${id} not found`,
        statusCode: HttpStatus.NOT_FOUND
      });
    }
    return order;
  }

  async changeOrderStatus(changeOrderStatusDto: ChangeOrderStatusDto) {
    const { id, status } = changeOrderStatusDto;
    const order = await this.findOne(id);
    if (order.status === status) {//optimisacion para evitar buscar el mismo objeto
      return order
    }
    return await this.order.update({
      where: { id: id },
      data: { status: status }
    });
    throw new NotImplementedException();
  }

}
