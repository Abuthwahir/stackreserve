'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import Link from 'next/link';

interface Reservation {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: 'pending' | 'confirmed' | 'released';
  expiresAt: string;
  product: {
    name: string;
  };
  warehouse: {
    name: string;
  };
}

interface ReservationDetailsProps {
  initialReservation: Reservation;
}

export default function ReservationDetails({ initialReservation }: ReservationDetailsProps) {
  const router = useRouter();
  const [reservation] = useState<Reservation>(initialReservation);
  const [status, setStatus] = useState<'pending' | 'confirmed' | 'released'>(initialReservation.status);
  const [timeLeft, setTimeLeft] = useState<string>('-');
  const [isExpired, setIsExpired] = useState<boolean>(false);
  const [pending, setPending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const calculateTimeLeft = (expiresAtStr: string) => {
    const expiresAt = new Date(expiresAtStr);
    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();

    if (diff <= 0) {
      return { text: 'Expired', expired: true };
    }

    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return { text: `${minutes}m ${seconds}s`, expired: false };
  };

  // Countdown timer logic
  useEffect(() => {
    if (status !== 'pending') {
      setTimeLeft('-');
      return;
    }

    const initial = calculateTimeLeft(reservation.expiresAt);
    setTimeLeft(initial.text);
    if (initial.expired) {
      setIsExpired(true);
      return;
    }

    const interval = setInterval(() => {
      const res = calculateTimeLeft(reservation.expiresAt);
      setTimeLeft(res.text);

      if (res.expired) {
        setIsExpired(true);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [reservation.expiresAt, status]);

  const handleConfirm = async () => {
    if (pending || isExpired || status !== 'pending') return;

    setPending(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/reservations/${reservation.id}/confirm`, {
        method: 'POST',
      });

      if (res.status === 410) {
        setError('This reservation session has expired. The stock has been released.');
        setIsExpired(true);
        setStatus('released');
        router.refresh();
        return;
      }

      if (res.status === 409) {
        const data = await res.json();
        setError(data.error || 'Insufficient stock to confirm this purchase.');
        router.refresh();
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to confirm purchase due to a server error.');
        return;
      }

      setSuccessMessage('Purchase completed successfully! Stock has been deducted.');
      setStatus('confirmed');
      router.refresh();
    } catch (err) {
      console.error('Confirm error:', err);
      setError('Network error: Could not reach the confirmation server. Please try again.');
    } finally {
      setPending(false);
    }
  };

  const handleCancel = async () => {
    if (pending || status !== 'pending') return;

    setPending(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/reservations/${reservation.id}/release`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to cancel reservation due to a server error.');
        return;
      }

      setSuccessMessage('Reservation cancelled. Reserved stock returned to available stock.');
      setStatus('released');
      router.refresh();
    } catch (err) {
      console.error('Cancel error:', err);
      setError('Network error: Could not cancel reservation. Please check connection.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="flex items-center space-x-2">
        <Link href="/" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
          ← Back to Inventories
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="bg-indigo-50 border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="font-bold text-indigo-900 text-lg">Checkout Reservation</h2>
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
              status === 'confirmed'
                ? 'bg-green-100 text-green-800'
                : status === 'released' || isExpired
                ? 'bg-red-100 text-red-800'
                : 'bg-yellow-100 text-yellow-805'
            }`}
          >
            {isExpired && status === 'pending' ? 'Expired' : status}
          </span>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
              <p className="text-sm text-red-700 font-semibold">{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-md">
              <p className="text-sm text-green-700 font-semibold">{successMessage}</p>
            </div>
          )}

          <div className="divide-y divide-gray-150 text-sm">
            <div className="py-2.5 flex justify-between">
              <span className="text-gray-400 font-medium">Reservation ID</span>
              <span className="font-mono text-gray-800 break-all select-all font-semibold max-w-[200px] text-right">
                {reservation.id}
              </span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-gray-400 font-medium">Product</span>
              <span className="text-gray-850 font-bold">{reservation.product.name}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-gray-400 font-medium">Warehouse</span>
              <span className="text-gray-850 font-bold">{reservation.warehouse.name}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-gray-400 font-medium">Reserved Quantity</span>
              <span className="text-gray-850 font-bold">{reservation.quantity} unit</span>
            </div>
            <div className="py-2.5 flex justify-between items-center">
              <span className="text-gray-400 font-medium">Expires At</span>
              <span className="text-gray-600 text-xs">
                {new Date(reservation.expiresAt).toLocaleTimeString()}
              </span>
            </div>
            
            {status === 'pending' && !isExpired && (
              <div className="py-3 flex justify-between items-center bg-indigo-50/50 -mx-6 px-6">
                <span className="text-indigo-900 font-semibold">Time Remaining</span>
                <span className="font-mono text-lg font-extrabold text-indigo-700">{timeLeft}</span>
              </div>
            )}
          </div>

          <div className="pt-4 flex flex-col space-y-3">
            <button
              disabled={pending || isExpired || status !== 'pending'}
              onClick={handleConfirm}
              className={`w-full py-2.5 px-4 rounded text-sm font-semibold transition-colors ${
                status === 'confirmed'
                  ? 'bg-green-600 text-white cursor-default'
                  : isExpired || status !== 'pending'
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : pending
                  ? 'bg-indigo-400 text-white cursor-wait'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
              }`}
            >
              {pending ? 'Processing Purchase...' : status === 'confirmed' ? 'Purchase Confirmed' : 'Confirm Purchase'}
            </button>

            {status === 'pending' && !isExpired && (
              <button
                disabled={pending}
                onClick={handleCancel}
                className={`w-full py-2 px-4 rounded text-sm font-semibold border transition-colors ${
                  pending
                    ? 'border-gray-200 text-gray-400 cursor-wait'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Cancel & Release Stock
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
