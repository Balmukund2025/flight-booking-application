import { useState, useEffect } from 'react';
import { useSearchFlights } from '../hooks/useQueries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plane, Clock, Filter } from 'lucide-react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { toast } from 'sonner';
import type { Flight, SearchCriteria } from '../backend';
import { TripType } from '../backend';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

export default function SearchResultsPage() {
  const navigate = useNavigate();
  const searchParams = useSearch({ from: '/search' }) as {
    origin: string;
    destination: string;
    departureDate: string;
    returnDate?: string;
    passengers: string;
    tripType: 'oneWay' | 'roundTrip';
  };

  const searchFlights = useSearchFlights();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [filteredFlights, setFilteredFlights] = useState<Flight[]>([]);
  const [sortBy, setSortBy] = useState<'price' | 'duration' | 'departure'>('price');
  const [maxPrice, setMaxPrice] = useState<number>(10000);
  const [selectedAirline, setSelectedAirline] = useState<string>('all');

  useEffect(() => {
    const fetchFlights = async () => {
      try {
        const criteria: SearchCriteria = {
          origin: searchParams.origin,
          destination: searchParams.destination,
          departureDate: BigInt(searchParams.departureDate),
          returnDate: searchParams.returnDate ? BigInt(searchParams.returnDate) : undefined,
          passengers: BigInt(searchParams.passengers),
          tripType: searchParams.tripType === 'oneWay' ? TripType.oneWay : TripType.roundTrip
        };

        const results = await searchFlights.mutateAsync({ criteria });
        setFlights(results);
        setFilteredFlights(results);
      } catch (error) {
        console.error('Error searching flights:', error);
        toast.error('Failed to search flights');
      }
    };

    fetchFlights();
  }, [searchParams]);

  useEffect(() => {
    let filtered = [...flights];

    // Filter by airline
    if (selectedAirline !== 'all') {
      filtered = filtered.filter((f) => f.airline === selectedAirline);
    }

    // Filter by price
    filtered = filtered.filter((f) => Number(f.price) <= maxPrice);

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'price') return Number(a.price) - Number(b.price);
      if (sortBy === 'duration') return Number(a.duration) - Number(b.duration);
      if (sortBy === 'departure') return Number(a.departureTime) - Number(b.departureTime);
      return 0;
    });

    setFilteredFlights(filtered);
  }, [flights, sortBy, maxPrice, selectedAirline]);

  const airlines = Array.from(new Set(flights.map((f) => f.airline)));

  const handleSelectFlight = (flight: Flight) => {
    navigate({ to: `/seat-selection/${flight.flightNumber}` });
  };

  if (searchFlights.isPending) {
    return (
      <div className="container py-8">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          {searchParams.origin} → {searchParams.destination}
        </h1>
        <p className="text-muted-foreground">
          {format(new Date(Number(searchParams.departureDate)), 'PPP')} • {searchParams.passengers} passenger
          {Number(searchParams.passengers) > 1 ? 's' : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters Sidebar */}
        <aside className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Sort By</Label>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="price">Price (Low to High)</SelectItem>
                    <SelectItem value="duration">Duration (Shortest)</SelectItem>
                    <SelectItem value="departure">Departure Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Airline</Label>
                <Select value={selectedAirline} onValueChange={setSelectedAirline}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Airlines</SelectItem>
                    {airlines.map((airline) => (
                      <SelectItem key={airline} value={airline}>
                        {airline}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Max Price: ${maxPrice}</Label>
                <Slider
                  value={[maxPrice]}
                  onValueChange={(v) => setMaxPrice(v[0])}
                  max={10000}
                  min={0}
                  step={100}
                />
              </div>
            </CardContent>
          </Card>
        </aside>

        {/* Results */}
        <div className="lg:col-span-3 space-y-4">
          {filteredFlights.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Plane className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No flights found</h3>
                <p className="text-muted-foreground">Try adjusting your filters or search criteria</p>
              </CardContent>
            </Card>
          ) : (
            filteredFlights.map((flight) => (
              <Card key={flight.flightNumber} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <Badge variant="outline" className="text-sm">
                          {flight.airline}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{flight.flightNumber}</span>
                        {flight.stops === BigInt(0) && (
                          <Badge className="bg-green-600">Direct</Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-4 items-center">
                        <div>
                          <div className="text-2xl font-bold">
                            {format(new Date(Number(flight.departureTime)), 'HH:mm')}
                          </div>
                          <div className="text-sm text-muted-foreground">{flight.origin}</div>
                        </div>

                        <div className="text-center">
                          <div className="flex items-center justify-center gap-2 mb-1">
                            <div className="h-px bg-border flex-1" />
                            <Plane className="h-4 w-4 text-muted-foreground" />
                            <div className="h-px bg-border flex-1" />
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                            <Clock className="h-3 w-3" />
                            {Math.floor(Number(flight.duration) / 60)}h {Number(flight.duration) % 60}m
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-2xl font-bold">
                            {format(new Date(Number(flight.arrivalTime)), 'HH:mm')}
                          </div>
                          <div className="text-sm text-muted-foreground">{flight.destination}</div>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{flight.aircraftType}</span>
                        <span>
                          {Number(flight.seatAvailability.available)} seats available
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-3">
                      <div className="text-right">
                        <div className="text-3xl font-bold text-blue-600">${Number(flight.price)}</div>
                        <div className="text-sm text-muted-foreground">per person</div>
                      </div>
                      <Button
                        onClick={() => handleSelectFlight(flight)}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Select Flight
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
