import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const warehouses = await prisma.warehouse.findMany({
      orderBy: {
        name: 'asc',
      },
    });
    return NextResponse.json(warehouses);
  } catch (error) {
    console.error('Error fetching warehouses:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while fetching warehouses' },
      { status: 500 }
    );
  }
}
