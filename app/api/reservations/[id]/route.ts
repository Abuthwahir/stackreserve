import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Missing reservation ID' }, { status: 400 });
    }

    // Fetch the reservation first
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        product: true,
        warehouse: true,
      },
    });

    if (!reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    // Dynamically check if a pending reservation has expired
    if (reservation.status === 'pending' && reservation.expiresAt < new Date()) {
      console.log(`Reservation ${id} is expired. Initiating dynamic auto-release...`);
      
      const updatedReservation = await prisma.$transaction(async (tx) => {
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
          throw new Error('Inventory not found during auto-release');
        }

        const inventory = inventories[0];

        // 2. Fetch fresh reservation status inside the lock
        const freshRes = await tx.reservation.findUnique({
          where: { id },
        });

        if (!freshRes || freshRes.status !== 'pending' || freshRes.expiresAt >= new Date()) {
          // If already modified by a concurrent request, abort changes and return current state
          return freshRes;
        }

        // 3. Decrement reservedStock safely (cannot go below 0)
        const decrementAmount = Math.min(inventory.reservedStock, freshRes.quantity);

        await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            reservedStock: {
              decrement: decrementAmount,
            },
          },
        });

        // 4. Set reservation status to released
        const updated = await tx.reservation.update({
          where: { id },
          data: { status: 'released' },
          include: {
            product: true,
            warehouse: true,
          },
        });

        return updated;
      });

      if (!updatedReservation) {
        return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
      }

      return NextResponse.json(updatedReservation);
    }

    return NextResponse.json(reservation);
  } catch (error) {
    console.error('Error fetching reservation:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while fetching the reservation' },
      { status: 500 }
    );
  }
}
