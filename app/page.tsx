import { headers } from 'next/headers';
import ProductList from '@/components/ProductList';

export const dynamic = 'force-dynamic';

async function getProducts() {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';

    const res = await fetch(`${protocol}://${host}/api/products`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`API returned status ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error('Error fetching products inside Page Server Component:', error);
    // Return empty list on failure, letting components render an empty state
    return [];
  }
}

export default async function HomePage() {
  const products = await getProducts();
  return <ProductList initialProducts={products} />;
}
