'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface InventoryItem {
  id: string;
  warehouseId: string;
  warehouseName: string;
  totalStock: number;
  reservedStock: number;
  availableStock: number;
}

interface Product {
  id: string;
  name: string;
  inventories: InventoryItem[];
}

interface ProductListProps {
  initialProducts: Product[];
}

export default function ProductList({ initialProducts }: ProductListProps) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleReserve = async (productId: string, warehouseId: string, itemKey: string) => {
    setLoadingId(itemKey);
    setError(null);

    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId,
          warehouseId,
          quantity: 1,
        }),
      });

      if (res.status === 409) {
        const data = await res.json();
        setError(data.error || 'Insufficient stock to fulfill this reservation.');
        setLoadingId(null);
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to reserve stock due to a server error.');
        setLoadingId(null);
        return;
      }

      const reservation = await res.json();
      router.push(`/reservation/${reservation.id}`);
    } catch (err) {
      console.error('Reservation error:', err);
      setError('Network error: Could not reach the reservation server. Please try again.');
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Product Inventories</h1>
        <button
          onClick={() => {
            setError(null);
            router.refresh();
          }}
          className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 py-1.5 px-3 rounded font-medium"
        >
          Refresh Stock
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-red-500 font-bold">⚠️</span>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700 font-semibold">{error}</p>
            </div>
          </div>
        </div>
      )}

      {initialProducts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">No products found. Please seed the database.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {initialProducts.map((product) => (
            <div key={product.id} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-indigo-50 px-4 py-3 border-b border-gray-200">
                <h2 className="font-bold text-lg text-indigo-900">{product.name}</h2>
              </div>
              <div className="p-4 space-y-4">
                {product.inventories.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No warehouse stock mapped.</p>
                ) : (
                  product.inventories.map((inv) => {
                    const itemKey = `${product.id}-${inv.warehouseId}`;
                    const isRowLoading = loadingId === itemKey;
                    const isAnyLoading = loadingId !== null;
                    const isOutOfStock = inv.availableStock <= 0;

                    return (
                      <div key={inv.warehouseId} className="border-b border-gray-100 last:border-b-0 pb-3 last:pb-0">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-semibold text-sm text-gray-800">{inv.warehouseName}</p>
                          </div>
                          <span
                            className={`text-xs px-2 py-0.5 rounded font-semibold ${
                              isOutOfStock
                                ? 'bg-red-100 text-red-800'
                                : 'bg-green-100 text-green-850'
                            }`}
                          >
                            {isOutOfStock ? 'Out of Stock' : `${inv.availableStock} Available`}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 text-xs text-gray-500 mb-3 bg-gray-50 p-2 rounded">
                          <div>
                            <span className="block font-medium text-gray-400">Total</span>
                            <span className="text-gray-700 font-semibold">{inv.totalStock}</span>
                          </div>
                          <div>
                            <span className="block font-medium text-gray-400">Reserved</span>
                            <span className="text-gray-700 font-semibold">{inv.reservedStock}</span>
                          </div>
                          <div>
                            <span className="block font-medium text-gray-400">Available</span>
                            <span className="text-gray-705 font-bold">{inv.availableStock}</span>
                          </div>
                        </div>

                        <button
                          disabled={isOutOfStock || isAnyLoading}
                          onClick={() => handleReserve(product.id, inv.warehouseId, itemKey)}
                          className={`w-full py-2 px-4 rounded text-sm font-semibold transition-colors ${
                            isOutOfStock
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : isRowLoading
                              ? 'bg-indigo-400 text-white cursor-wait'
                              : isAnyLoading
                              ? 'bg-indigo-300 text-white cursor-not-allowed'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                          }`}
                        >
                          {isRowLoading ? 'Reserving...' : isOutOfStock ? 'Sold Out' : 'Reserve Unit'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
