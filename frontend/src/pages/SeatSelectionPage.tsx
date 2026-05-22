import { useState, useEffect } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { useGetFlight, useGetSeatMap, useBookSeats, useCreateStripeCheckoutSession } from '../hooks/useQueries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import type { PassengerDetail, SeatSelection, Seat } from '../backend';
import { SeatType } from '../backend';
import { Plane } from 'lucide-react';

export default function SeatSelectionPage() {
  const { flightNumber } = useParams({ from: '/seat-selection/$flightNumber' });
  const navigate = useNavigate();
  const { identity } = useInternetIdentity();
  const { data: flight, isLoading: flightLoading } = useGetFlight(flightNumber);
  const { data: seatMap, isLoading: seatMapLoading } = useGetSeatMap(flightNumber);
  const bookSeats = useBookSeats();
  const createCheckout = useCreateStripeCheckoutSession();

  const [passengers, setPassengers] = useState<PassengerDetail[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<Map<number, (number | bigint)[]>>(new Map());
  const [currentPassengerIndex, setCurrentPassengerIndex] = useState(0);

  useEffect(() => {
    if (flight) {
      const passengerCount = 1; // Default to 1, could be passed from search
      setPassengers(
        Array.from({ length: passengerCount }, (_, i) => ({
          name: '',
          age: BigInt(0),
          seatPreference: BigInt(0),
          seatType: SeatType.economy,
          seatNumber: undefined
        }))
      );
    }
  }, [flight]);

  if (!identity) {
    return (
      <div className="container py-8">
        <Card>
          <CardContent className="p-12 text-center">
            <h3 className="text-xl font-semibold mb-2">Login Required</h3>
            <p className="text-muted-foreground">Please login to book seats</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (flightLoading || seatMapLoading) {
    return (
      <div className="container py-8">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!flight || !seatMap) {
    return (
      <div className="container py-8">
        <Card>
          <CardContent className="p-12 text-center">
            <h3 className="text-xl font-semibold mb-2">Flight not found</h3>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSeatClick = (seat: Seat) => {
    if (seat.isOccupied) return;

    const seatCoords = [seat.row, seat.column];
    const newSelected = new Map(selectedSeats);

    // Check if seat is already selected
    const isSelected = Array.from(newSelected.values()).some(
      (coords) => coords[0] === seatCoords[0] && coords[1] === seatCoords[1]
    );

    if (isSelected) {
      // Remove seat
      for (const [key, coords] of newSelected.entries()) {
        if (coords[0] === seatCoords[0] && coords[1] === seatCoords[1]) {
          newSelected.delete(key);
          break;
        }
      }
    } else {
      // Add seat for current passenger
      if (newSelected.size < passengers.length) {
        newSelected.set(currentPassengerIndex, seatCoords);
        if (currentPassengerIndex < passengers.length - 1) {
          setCurrentPassengerIndex(currentPassengerIndex + 1);
        }
      }
    }

    setSelectedSeats(newSelected);
  };

  const isSeatSelected = (seat: Seat) => {
    return Array.from(selectedSeats.values()).some(
      (coords) => coords[0] === seat.row && coords[1] === seat.column
    );
  };

  const handlePassengerChange = (index: number, field: keyof PassengerDetail, value: string | bigint) => {
    const updated = [...passengers];
    if (field === 'name') {
      updated[index] = { ...updated[index], name: value as string };
    } else if (field === 'age') {
      updated[index] = { ...updated[index], age: BigInt(value) };
    }
    setPassengers(updated);
  };

  const handleBooking = async () => {
    // Validate passenger details
    for (const passenger of passengers) {
      if (!passenger.name.trim() || passenger.age === BigInt(0)) {
        toast.error('Please fill in all passenger details');
        return;
      }
    }

    if (selectedSeats.size !== passengers.length) {
      toast.error('Please select seats for all passengers');
      return;
    }

    try {
      // Update passengers with seat numbers
      const updatedPassengers = passengers.map((p, i) => {
        const seatCoords = selectedSeats.get(i);
        return {
          ...p,
          seatNumber: seatCoords ? [BigInt(seatCoords[0]), BigInt(seatCoords[1])] as [bigint, bigint] : undefined
        };
      });

      const seatSelections: SeatSelection[] = Array.from(selectedSeats.values()).map((coords) => {
        const seat = seatMap.seats.find((s) => s.row === coords[0] && s.column === coords[1]);
        return {
          seatNumber: [BigInt(coords[0]), BigInt(coords[1])] as [bigint, bigint],
          seatType: seat?.isPremium ? SeatType.premiumEconomy : SeatType.economy,
          priceModifier: seat?.isPremium ? 1.5 : 1.0
        };
      });

      const bookingResult = await bookSeats.mutateAsync({
        flightNumber,
        passengers: updatedPassengers,
        seats: seatSelections
      });

      toast.success('Booking created! Proceeding to payment...');

      // Create Stripe checkout session
      const baseUrl = `${window.location.protocol}//${window.location.host}`;
      const items = [
        {
          productName: `Flight ${flight.flightNumber}`,
          productDescription: `${flight.origin} to ${flight.destination}`,
          priceInCents: BigInt(Number(flight.price) * 100),
          quantity: BigInt(passengers.length),
          currency: 'usd'
        }
      ];

      const session = await createCheckout.mutateAsync({
        bookingId: bookingResult.booking.bookingId,
        items,
        successUrl: `${baseUrl}/payment-success?bookingId=${bookingResult.booking.bookingId}`,
        cancelUrl: `${baseUrl}/payment-failure`
      });

      window.location.href = session.url;
    } catch (error) {
      console.error('Booking error:', error);
      toast.error('Failed to create booking');
    }
  };

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Select Your Seats</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Seat Map */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Seat Map - {flight.aircraftType}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-6 flex items-center justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded border-2 border-border bg-background" />
                  <span>Available</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded border-2 border-blue-600 bg-blue-600" />
                  <span>Selected</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded border-2 border-border bg-muted" />
                  <span>Occupied</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded border-2 border-purple-600 bg-purple-100 dark:bg-purple-900" />
                  <span>Premium</span>
                </div>
              </div>

              <div className="flex flex-col items-center gap-2">
                {/* Cockpit */}
                <div className="w-full max-w-md">
                  <div className="bg-muted rounded-t-full h-12 flex items-center justify-center">
                    <Plane className="h-6 w-6 text-muted-foreground" />
                  </div>
                </div>

                {/* Seats */}
                <div className="w-full max-w-md space-y-2">
                  {Array.from({ length: Number(seatMap.rows) }, (_, rowIndex) => {
                    const rowSeats = seatMap.seats.filter((s) => Number(s.row) === rowIndex);
                    return (
                      <div key={rowIndex} className="flex items-center justify-center gap-2">
                        <span className="text-xs text-muted-foreground w-6">{rowIndex + 1}</span>
                        {rowSeats.map((seat, colIndex) => {
                          const isSelected = isSeatSelected(seat);
                          return (
                            <button
                              key={`${rowIndex}-${colIndex}`}
                              onClick={() => handleSeatClick(seat)}
                              disabled={seat.isOccupied}
                              className={`h-8 w-8 rounded border-2 transition-colors ${
                                seat.isOccupied
                                  ? 'border-border bg-muted cursor-not-allowed'
                                  : isSelected
                                    ? 'border-blue-600 bg-blue-600 text-white'
                                    : seat.isPremium
                                      ? 'border-purple-600 bg-purple-100 dark:bg-purple-900 hover:bg-purple-200 dark:hover:bg-purple-800'
                                      : 'border-border bg-background hover:bg-accent'
                              }`}
                            >
                              {colIndex < 3 ? String.fromCharCode(65 + colIndex) : String.fromCharCode(68 + colIndex - 3)}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Passenger Details */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Passenger Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {passengers.map((passenger, index) => (
                <div key={index} className="space-y-3 p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">Passenger {index + 1}</h4>
                    {selectedSeats.has(index) && (
                      <Badge variant="outline">
                        Seat {String.fromCharCode(65 + Number(selectedSeats.get(index)![1]))}
                        {Number(selectedSeats.get(index)![0]) + 1}
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`name-${index}`}>Full Name</Label>
                    <Input
                      id={`name-${index}`}
                      value={passenger.name}
                      onChange={(e) => handlePassengerChange(index, 'name', e.target.value)}
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`age-${index}`}>Age</Label>
                    <Input
                      id={`age-${index}`}
                      type="number"
                      value={passenger.age === BigInt(0) ? '' : Number(passenger.age)}
                      onChange={(e) => handlePassengerChange(index, 'age', e.target.value)}
                      placeholder="25"
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Booking Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Flight</span>
                <span className="font-semibold">{flight.flightNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Passengers</span>
                <span className="font-semibold">{passengers.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Price per person</span>
                <span className="font-semibold">${Number(flight.price)}</span>
              </div>
              <div className="border-t pt-3 flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-blue-600">${Number(flight.price) * passengers.length}</span>
              </div>
              <Button
                onClick={handleBooking}
                disabled={bookSeats.isPending || createCheckout.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {bookSeats.isPending || createCheckout.isPending ? 'Processing...' : 'Proceed to Payment'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
