import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { CreateReservationInputSchema } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // Validate request body
    const validation = CreateReservationInputSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { productId, warehouseId, quantity, expiresInMinutes = 10 } = validation.data;

    // Use an interactive Prisma transaction for concurrency safety
    const result = await prisma.$transaction(async (tx) => {
      // 1. Lock the inventory row using SELECT ... FOR UPDATE in PostgreSQL
      interface InventoryLock {
        id: string;
        totalStock: number;
        reservedStock: number;
      }

      const inventories = await tx.$queryRaw<InventoryLock[]>`
        SELECT id, "totalStock", "reservedStock"
        FROM "Inventory"
        WHERE "productId" = ${productId} AND "warehouseId" = ${warehouseId}
        LIMIT 1
        FOR UPDATE
      `;

      if (inventories.length === 0) {
        return {
          status: 404,
          error: 'Inventory record not found for the specified product and warehouse combination',
        };
      }

      const inventory = inventories[0];
      const availableStock = inventory.totalStock - inventory.reservedStock;

      // 2. Check if there is enough available stock
      if (availableStock < quantity) {
        return {
          status: 409,
          error: `Insufficient stock. Requested: ${quantity}, Available: ${availableStock}`,
        };
      }

      const newReservedStock = inventory.reservedStock + quantity;
      
      // Ensure reserved stock does not become negative (defense-in-depth)
      if (newReservedStock < 0) {
        return {
          status: 400,
          error: 'Reserved stock cannot go below zero',
        };
      }

      // 3. Atomically increment the reserved stock
      await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          reservedStock: {
            increment: quantity,
          },
        },
      });

      // 4. Create the pending reservation
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);

      const reservation = await tx.reservation.create({
        data: {
          productId,
          warehouseId,
          quantity,
          status: 'pending',
          expiresAt,
        },
        include: {
          product: true,
          warehouse: true,
        },
      });

      return { status: 201, data: reservation };
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.data, { status: 201 });
  } catch (error) {
    console.error('Error creating reservation:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while processing the reservation' },
      { status: 500 }
    );
  }
}
