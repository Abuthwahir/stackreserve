import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seeding...');

  // Clean existing records to keep seeding idempotent
  console.log('Clearing existing records...');
  await prisma.reservation.deleteMany({});
  await prisma.inventory.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.warehouse.deleteMany({});

  // Seed Warehouses
  console.log('Creating warehouses...');
  const bangaloreWarehouse = await prisma.warehouse.create({
    data: { name: 'Bangalore Warehouse' },
  });
  const mumbaiWarehouse = await prisma.warehouse.create({
    data: { name: 'Mumbai Warehouse' },
  });

  // Seed Products
  console.log('Creating products...');
  const iphone15 = await prisma.product.create({
    data: { name: 'iPhone 15' },
  });
  const macbookAir = await prisma.product.create({
    data: { name: 'MacBook Air M3' },
  });
  const airpodsPro = await prisma.product.create({
    data: { name: 'AirPods Pro' },
  });

  const warehouses = [bangaloreWarehouse, mumbaiWarehouse];
  const products = [iphone15, macbookAir, airpodsPro];

  // Stock mapping by Product Name and Warehouse Name
  const stockMap: Record<string, Record<string, number>> = {
    'iPhone 15': {
      'Bangalore Warehouse': 100,
      'Mumbai Warehouse': 80,
    },
    'MacBook Air M3': {
      'Bangalore Warehouse': 50,
      'Mumbai Warehouse': 40,
    },
    'AirPods Pro': {
      'Bangalore Warehouse': 200,
      'Mumbai Warehouse': 150,
    },
  };

  // Seed inventories for every combination of product and warehouse
  console.log('Creating inventories...');
  for (const product of products) {
    for (const warehouse of warehouses) {
      const totalStock = stockMap[product.name]?.[warehouse.name] ?? 0;
      await prisma.inventory.create({
        data: {
          productId: product.id,
          warehouseId: warehouse.id,
          totalStock,
          reservedStock: 0,
        },
      });
      console.log(`- Seeded ${product.name} at ${warehouse.name} with stock: ${totalStock}`);
    }
  }

  console.log('Database seeding complete!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
