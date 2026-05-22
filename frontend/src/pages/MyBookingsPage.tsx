import { useGetCallerBookings, useUpdateBookingStatus } from '../hooks/useQueries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plane, Calendar, Users } from 'lucide-react';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { BookingStatus } from '../backend';

export default function MyBookingsPage() {
  const { identity } = useInternetIdentity();
  const { data: bookings, isLoading } = useGetCallerBookings();
  const updateStatus = useUpdateBookingStatus();

  if (!identity) {
    return (
      <div className="container py-8">
        <Card>
          <CardContent className="p-12 text-center">
            <h3 className="text-xl font-semibold mb-2">Login Required</h3>
            <p className="text-muted-foreground">Please login to view your bookings</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const handleCancelBooking = async (bookingId: bigint) => {
    try {
      await updateStatus.mutateAsync({
        bookingId,
        status: BookingStatus.cancelled
      });
      toast.success('Booking cancelled successfully');
    } catch (error) {
      console.error('Error cancelling booking:', error);
      toast.error('Failed to cancel booking');
    }
  };

  const getStatusBadge = (status: BookingStatus) => {
    const variants: Record<BookingStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      [BookingStatus.pending]: 'secondary',
      [BookingStatus.confirmed]: 'default',
      [BookingStatus.cancelled]: 'destructive',
      [BookingStatus.checkedIn]: 'outline'
    };
    return (
      <Badge variant={variants[status] || 'default'} className="capitalize">
        {status}
      </Badge>
    );
  };

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">My Bookings</h1>

      {!bookings || bookings.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Plane className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No bookings yet</h3>
            <p className="text-muted-foreground">Start exploring flights and make your first booking!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <Card key={booking.bookingId.toString()}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Booking #{booking.bookingId.toString()}</CardTitle>
                  {getStatusBadge(booking.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Plane className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-semibold">{booking.flight.flightNumber}</div>
                        <div className="text-sm text-muted-foreground">{booking.flight.airline}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-semibold">
                          {format(new Date(Number(booking.flight.departureTime)), 'PPP')}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(Number(booking.flight.departureTime)), 'HH:mm')} -{' '}
                          {format(new Date(Number(booking.flight.arrivalTime)), 'HH:mm')}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-semibold">{booking.passengers.length} Passenger(s)</div>
                        <div className="text-sm text-muted-foreground">
                          {booking.passengers.map((p) => p.name).join(', ')}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Route</div>
                      <div className="font-semibold">
                        {booking.flight.origin} → {booking.flight.destination}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Seats</div>
                      <div className="flex gap-2 flex-wrap">
                        {booking.seats.map((seat, idx) => (
                          <Badge key={idx} variant="outline">
                            {String.fromCharCode(65 + Number(seat.seatNumber[1]))}
                            {Number(seat.seatNumber[0]) + 1}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {booking.status === BookingStatus.confirmed && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleCancelBooking(booking.bookingId)}
                        disabled={updateStatus.isPending}
                      >
                        Cancel Booking
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
