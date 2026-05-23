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

      // Prevent confirming already released reservation
      if (reservation.status === 'released') {
        return { status: 400, error: 'Cannot confirm a released reservation' };
      }

      // Prevent double confirmation
      if (reservation.status === 'confirmed') {
        return { status: 400, error: 'Reservation is already confirmed' };
      }

      // Return 410 if reservation has expired
      const now = new Date();
      if (reservation.expiresAt < now) {
        return { status: 410, error: 'Reservation has expired' };
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
      if (inventory.totalStock < reservation.quantity) {
        return {
          status: 409,
          error: `Insufficient total stock to confirm reservation. Current total: ${inventory.totalStock}, Required: ${reservation.quantity}`,
        };
      }
      if (inventory.reservedStock < reservation.quantity) {
        return {
          status: 409,
          error: `Reserved stock would become negative. Current reserved: ${inventory.reservedStock}, Required: ${reservation.quantity}`,
        };
      }

      // 4. Commit the inventory: decrement both totalStock and reservedStock
      await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          totalStock: {
            decrement: reservation.quantity,
          },
          reservedStock: {
            decrement: reservation.quantity,
          },
        },
      });

      // 5. Update reservation status to confirmed
      const updatedReservation = await tx.reservation.update({
        where: { id },
        data: { status: 'confirmed' },
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
      message: 'Reservation confirmed successfully',
      reservation: result.data,
    });
  } catch (error) {
    console.error('Error confirming reservation:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while confirming the reservation' },
      { status: 500 }
    );
  }
}
