import { OrderStatus } from "@prisma/client";

export interface OrderWithProducts {
    OrderItem: {
        name: string;
        productId: number;
        quantity: number;
        unitPrice: number;
    }[];
    id: string;
    totalAmount: number;
    totalItems: number;
    status: OrderStatus;
    paid: boolean;
    paidAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}