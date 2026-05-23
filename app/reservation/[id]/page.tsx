import { headers } from 'next/headers';
import Link from 'next/link';
import ReservationDetails from '@/components/ReservationDetails';

export const dynamic = 'force-dynamic';

async function getReservation(id: string) {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';

    const res = await fetch(`${protocol}://${host}/api/reservations/${id}`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      if (res.status === 404) {
        return null;
      }
      throw new Error(`API returned status ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error('Error fetching reservation in Page Server Component:', error);
    return null;
  }
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReservationPage({ params }: PageProps) {
  const { id } = await params;
  const reservation = await getReservation(id);

  if (!reservation) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200 max-w-md mx-auto">
        <h2 className="text-xl font-bold text-red-650 mb-2">Reservation Not Found</h2>
        <p className="text-gray-500 mb-6">
          The requested reservation could not be found or may have expired and been cleaned up.
        </p>
        <Link
          href="/"
          className="inline-block bg-indigo-600 hover:bg-indigo-750 text-white font-semibold py-2 px-4 rounded text-sm transition-colors"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  return <ReservationDetails initialReservation={reservation} />;
}
