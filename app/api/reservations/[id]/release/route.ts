import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Missing reservation ID' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch reservation to check status and validity
      const reservation = await tx.reservation.findUnique({
        where: { id },
      });

      if (!reservation) {
        return { status: 404, error: 'Reservation not found' };
      }

      // Prevent double release
      if (reservation.status === 'released') {
        return { status: 400, error: 'Reservation is already released' };
      }

      // Prevent releasing confirmed reservation
      if (reservation.status === 'confirmed') {
        return { status: 400, error: 'Cannot release a confirmed reservation' };
      }

      // 2. Lock the inventory row using SELECT ... FOR UPDATE to prevent race conditions
      interface InventoryLock {
        id: string;
        totalStock: number;
        reservedStock: number;
      }

      const inventories = await tx.$queryRaw<InventoryLock[]>`
        SELECT id, "totalStock", "reservedStock"
        FROM "Inventory"
        WHERE "productId" = ${reservation.productId} AND "warehouseId" = ${reservation.warehouseId}
        LIMIT 1
        FOR UPDATE
      `;

      if (inventories.length === 0) {
        return { status: 404, error: 'Associated inventory record not found' };
      }

      const inventory = inventories[0];

      // 3. Prevent negative stock values
      // Decrement by the minimum of current reserved stock or reservation quantity
      // to ensure reservedStock never goes below 0.
      const decrementAmount = Math.min(inventory.reservedStock, reservation.quantity);

      // 4. Decrement reservedStock safely
      await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          reservedStock: {
            decrement: decrementAmount,
          },
        },
      });

      // 5. Update reservation status to released
      const updatedReservation = await tx.reservation.update({
        where: { id },
        data: { status: 'released' },
        include: {
          product: true,
          warehouse: true,
        },
      });

      return { status: 200, data: updatedReservation };
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      message: 'Reservation released successfully',
      reservation: result.data,
    });
  } catch (error) {
    console.error('Error releasing reservation:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while releasing the reservation' },
      { status: 500 }
    );
  }
}
