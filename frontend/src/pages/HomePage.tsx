import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Plane, MapPin, Users } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';

const popularCities = [
  'New York (JFK)',
  'Los Angeles (LAX)',
  'London (LHR)',
  'Paris (CDG)',
  'Tokyo (NRT)',
  'Dubai (DXB)',
  'Singapore (SIN)',
  'Sydney (SYD)',
  'Mumbai (BOM)',
  'Toronto (YYZ)'
];

export default function HomePage() {
  const navigate = useNavigate();
  const [tripType, setTripType] = useState<'oneWay' | 'roundTrip'>('roundTrip');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [departureDate, setDepartureDate] = useState<Date>();
  const [returnDate, setReturnDate] = useState<Date>();
  const [passengers, setPassengers] = useState('1');

  const handleSearch = () => {
    if (!origin || !destination || !departureDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (tripType === 'roundTrip' && !returnDate) {
      toast.error('Please select a return date');
      return;
    }

    navigate({
      to: '/search',
      search: {
        origin: origin.split('(')[0].trim(),
        destination: destination.split('(')[0].trim(),
        departureDate: departureDate.getTime().toString(),
        returnDate: returnDate?.getTime().toString(),
        passengers: passengers,
        tripType
      }
    });
  };

  return (
    <div className="min-h-[calc(100vh-8rem)]">
      {/* Hero Section */}
      <section className="relative h-[500px] overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="/assets/generated/hero-airplane.dim_1200x600.jpg"
            alt="Airplane"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/80 to-blue-600/60" />
        </div>
        <div className="relative container h-full flex flex-col items-center justify-center text-center text-white">
          <h1 className="text-5xl md:text-6xl font-bold mb-4">Find Your Perfect Flight</h1>
          <p className="text-xl md:text-2xl mb-8 text-blue-100">
            Search, compare, and book flights to destinations worldwide
          </p>
        </div>
      </section>

      {/* Search Form */}
      <section className="container -mt-20 relative z-10 mb-16">
        <Card className="shadow-2xl">
          <CardContent className="p-6 md:p-8">
            <div className="flex gap-4 mb-6">
              <Button
                variant={tripType === 'oneWay' ? 'default' : 'outline'}
                onClick={() => setTripType('oneWay')}
                className={tripType === 'oneWay' ? 'bg-blue-600 hover:bg-blue-700' : ''}
              >
                One Way
              </Button>
              <Button
                variant={tripType === 'roundTrip' ? 'default' : 'outline'}
                onClick={() => setTripType('roundTrip')}
                className={tripType === 'roundTrip' ? 'bg-blue-600 hover:bg-blue-700' : ''}
              >
                Round Trip
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="space-y-2">
                <Label htmlFor="origin" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  From
                </Label>
                <Select value={origin} onValueChange={setOrigin}>
                  <SelectTrigger id="origin">
                    <SelectValue placeholder="Select origin" />
                  </SelectTrigger>
                  <SelectContent>
                    {popularCities.map((city) => (
                      <SelectItem key={city} value={city}>
                        {city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="destination" className="flex items-center gap-2">
                  <Plane className="h-4 w-4" />
                  To
                </Label>
                <Select value={destination} onValueChange={setDestination}>
                  <SelectTrigger id="destination">
                    <SelectValue placeholder="Select destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {popularCities.map((city) => (
                      <SelectItem key={city} value={city}>
                        {city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Departure
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      {departureDate ? format(departureDate, 'PPP') : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={departureDate} onSelect={setDepartureDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>

              {tripType === 'roundTrip' && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    Return
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        {returnDate ? format(returnDate, 'PPP') : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={returnDate} onSelect={setReturnDate} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="passengers" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Passengers
                </Label>
                <Select value={passengers} onValueChange={setPassengers}>
                  <SelectTrigger id="passengers">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        {num} {num === 1 ? 'Passenger' : 'Passengers'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={handleSearch} className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-6">
              Search Flights
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Features Section */}
      <section className="container mb-16">
        <h2 className="text-3xl font-bold text-center mb-12">Why Choose SkyBooker?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <Plane className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Wide Selection</h3>
              <p className="text-muted-foreground">
                Access flights from multiple airlines to destinations worldwide
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <img src="/assets/generated/payment-icon-transparent.dim_64x64.png" alt="Payment" className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Secure Payment</h3>
              <p className="text-muted-foreground">Safe and secure payment processing with Stripe integration</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                <img src="/assets/generated/seat-icon-transparent.dim_64x64.png" alt="Seat" className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Seat Selection</h3>
              <p className="text-muted-foreground">Choose your preferred seats with our interactive seat maps</p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
