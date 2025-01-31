import { HttpStatus, Inject, Injectable, Logger, NotImplementedException, OnModuleInit } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { PrismaClient } from '@prisma/client';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { OrderPaginationDto } from './dto/order-pagination.dto';
import { ChangeOrderStatusDto, PaidOrderDto } from './dto';
import { NATS_SERVERS } from 'src/config';
import { firstValueFrom } from 'rxjs';
import { OrderWithProducts } from './interfaces/order-with-products.interface';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger('OrdersService');


  constructor(@Inject(NATS_SERVERS) private readonly client: ClientProxy) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to database OrdersService');
  }
  async create(createOrderDto: CreateOrderDto) {
    try {
      //1 - Validar que los productos estén disponibles
      const productsIds = createOrderDto.items.map(item => item.productId)

      const products = await firstValueFrom(this.client.send({ cmd: 'validate_products' }, productsIds));

      //2 - Calcular los valores
      const totalAmount = createOrderDto.items.reduce((acc, orderItem) => {
        const item = products.find(product => product.id === orderItem.productId)
        return acc + item.price * orderItem.quantity
      }, 0)

      const totalItems = createOrderDto.items.reduce((acc, orderItem) => {
        return acc + orderItem.quantity
      }, 0)

      //3 - Crear una transaccion de base de datos

      const order = await this.order.create({
        data: {
          totalAmount,
          totalItems,
          OrderItem: {
            createMany: {
              data: createOrderDto.items.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: products.find(product => product.id === item.productId).price
              }))
            }
          }
        }, include: {
          OrderItem: {
            select: {
              productId: true,
              quantity: true,
              unitPrice: true
            }
          }
        }
      })

      return {
        ...order,
        OrderItem: order.OrderItem.map(orderItem => ({
          ...orderItem,
          name: products.find(product => product.id === orderItem.productId).name
        }))
      }
    } catch (error) {
      throw new RpcException({
        message: error.message,
        statusCode: HttpStatus.BAD_REQUEST
      })
    }

    // return { service: 'OrdersService', method: 'create', data: createOrderDto }
    // return this.order.create({ data: createOrderDto });
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
      include: {
        OrderItem: {
          select: {
            unitPrice: true,
            quantity: true,
            productId: true
          }
        }
      },
    });
    if (!order) {
      throw new RpcException({
        message: `order ${id} not found`,
        statusCode: HttpStatus.NOT_FOUND
      });
    }
    const productIds = order.OrderItem.map(item => item.productId)
    const products = await firstValueFrom(this.client.send({ cmd: 'validate_products' }, productIds));

    return {
      ...order,
      OrderItem: order.OrderItem.map(orderItem => ({
        ...orderItem,
        name: products.find(product => product.id === orderItem.productId).name
      }))
    };
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

  async createPaymentSession(order: OrderWithProducts) {
    const paymentSession = await firstValueFrom(
      this.client.send('create-payment-session', {
        orderId: order.id,
        currency: 'usd',
        items: order.OrderItem.map(item => ({
          name: item.name,
          price: item.unitPrice,
          quantity: item.quantity
        }))
      })
    );
    return paymentSession;
  }

  async paidOrder(paidOrderDto: PaidOrderDto) {
    this.logger.log(`Order ${paidOrderDto} paid`);

    const order = await this.order.update({
      where: { id: paidOrderDto.orderId },
      data: {
        paid: true, paidAt: new Date(), stripeChargeId: paidOrderDto.stripePaymentId,
        //RELACION
        OrderReceipt: {
          create: {
            receiptUrl: paidOrderDto.receipUrl
          }
        }
      }
    });
    return order
  }
}
