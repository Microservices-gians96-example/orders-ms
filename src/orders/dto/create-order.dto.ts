import { OrderStatus } from "@prisma/client";
import { IsEnum, IsNumber, IsPositive } from "class-validator";

export class CreateOrderDto {
    @IsNumber()
    @IsPositive()
    totalAmount: number;
    @IsNumber()
    @IsPositive()
    totalItems: number;
    @IsEnum(OrderStatus)
    status: OrderStatus = OrderStatus.PENDING;

    paid: boolean = false;
}