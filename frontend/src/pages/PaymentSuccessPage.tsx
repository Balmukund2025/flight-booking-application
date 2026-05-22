import { useEffect } from 'react';
import { useSearch, useNavigate } from '@tanstack/react-router';
import { useCompletePayment, useGetBooking } from '../hooks/useQueries';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function PaymentSuccessPage() {
  const navigate = useNavigate();
  const searchParams = useSearch({ from: '/payment-success' }) as { bookingId?: string; session_id?: string };
  const completePayment = useCompletePayment();
  const bookingId = searchParams.bookingId ? BigInt(searchParams.bookingId) : null;
  const { data: booking } = useGetBooking(bookingId);

  useEffect(() => {
    const processPayment = async () => {
      if (searchParams.bookingId && searchParams.session_id) {
        try {
          await completePayment.mutateAsync({
            bookingId: BigInt(searchParams.bookingId),
            sessionId: searchParams.session_id
          });
          toast.success('Payment completed successfully!');
        } catch (error) {
          console.error('Error completing payment:', error);
          toast.error('Failed to complete payment');
        }
      }
    };

    processPayment();
  }, [searchParams.bookingId, searchParams.session_id]);

  return (
    <div className="container py-16">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="p-12 text-center">
            <div className="mb-6">
              <img
                src="/assets/generated/success-icon-transparent.dim_64x64.png"
                alt="Success"
                className="h-24 w-24 mx-auto mb-4"
              />
              <CheckCircle className="h-24 w-24 mx-auto text-green-600 mb-4" />
            </div>
            <h1 className="text-3xl font-bold mb-4">Booking Confirmed!</h1>
            <p className="text-lg text-muted-foreground mb-8">
              Your flight has been successfully booked. A confirmation email has been sent to your registered email
              address.
            </p>

            {booking && (
              <div className="bg-muted/50 rounded-lg p-6 mb-8 text-left">
                <h3 className="font-semibold mb-4">Booking Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Booking ID:</span>
                    <span className="font-mono">{booking.bookingId.toString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Flight:</span>
                    <span className="font-semibold">{booking.flight.flightNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Route:</span>
                    <span>
                      {booking.flight.origin} → {booking.flight.destination}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Passengers:</span>
                    <span>{booking.passengers.length}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-4 justify-center">
              <Button onClick={() => navigate({ to: '/my-bookings' })} className="bg-blue-600 hover:bg-blue-700">
                View My Bookings
              </Button>
              <Button onClick={() => navigate({ to: '/' })} variant="outline">
                Book Another Flight
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
