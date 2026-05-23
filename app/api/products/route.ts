import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: {
        inventories: {
          include: {
            warehouse: true,
          },
          orderBy: {
            warehouse: {
              name: 'asc',
            },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    const formattedProducts = products.map((product) => ({
      id: product.id,
      name: product.name,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      inventories: product.inventories.map((inv) => ({
        id: inv.id,
        warehouseId: inv.warehouseId,
        warehouseName: inv.warehouse.name,
        totalStock: inv.totalStock,
        reservedStock: inv.reservedStock,
        availableStock: inv.totalStock - inv.reservedStock,
        createdAt: inv.createdAt,
        updatedAt: inv.updatedAt,
      })),
    }));

    return NextResponse.json(formattedProducts);
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while fetching products' },
      { status: 500 }
    );
  }
}
