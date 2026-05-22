import { useState } from 'react';
import { useGetAllFlights, useAddFlight, useDeleteFlight, useIsCallerAdmin } from '../hooks/useQueries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import type { Flight, Seat, SeatMap } from '../backend';

export default function AdminPage() {
  const { data: isAdmin, isLoading: adminLoading } = useIsCallerAdmin();
  const { data: flights, isLoading: flightsLoading } = useGetAllFlights();
  const addFlight = useAddFlight();
  const deleteFlight = useDeleteFlight();
  const [dialogOpen, setDialogOpen] = useState(false);

  const [newFlight, setNewFlight] = useState<Partial<Flight>>({
    flightNumber: '',
    airline: '',
    origin: '',
    destination: '',
    departureTime: BigInt(Date.now()),
    arrivalTime: BigInt(Date.now() + 3600000),
    duration: BigInt(60),
    price: BigInt(200),
    stops: BigInt(0),
    aircraftType: 'Boeing 737'
  });

  if (adminLoading) {
    return (
      <div className="container py-8">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container py-8">
        <Card>
          <CardContent className="p-12 text-center">
            <h3 className="text-xl font-semibold mb-2">Access Denied</h3>
            <p className="text-muted-foreground">You do not have permission to access this page</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleAddFlight = async () => {
    if (
      !newFlight.flightNumber ||
      !newFlight.airline ||
      !newFlight.origin ||
      !newFlight.destination
    ) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Generate seat map
    const rows = 20;
    const columns = 6;
    const seats: Seat[] = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        seats.push({
          row: BigInt(row),
          column: BigInt(col),
          isWindow: col === 0 || col === 5,
          isAisle: col === 2 || col === 3,
          isPremium: row < 3,
          isOccupied: false
        });
      }
    }

    const seatMap: SeatMap = {
      rows: BigInt(rows),
      columns: BigInt(columns),
      seats
    };

    const flight: Flight = {
      flightNumber: newFlight.flightNumber!,
      airline: newFlight.airline!,
      origin: newFlight.origin!,
      destination: newFlight.destination!,
      departureTime: newFlight.departureTime!,
      arrivalTime: newFlight.arrivalTime!,
      duration: newFlight.duration!,
      price: newFlight.price!,
      priceRange: {
        low: newFlight.price!,
        medium: newFlight.price! + BigInt(100),
        high: newFlight.price! + BigInt(200)
      },
      stops: newFlight.stops!,
      seatAvailability: {
        available: BigInt(rows * columns),
        occupied: BigInt(0)
      },
      seats: seatMap,
      aircraftType: newFlight.aircraftType!
    };

    try {
      await addFlight.mutateAsync(flight);
      toast.success('Flight added successfully');
      setDialogOpen(false);
      setNewFlight({
        flightNumber: '',
        airline: '',
        origin: '',
        destination: '',
        departureTime: BigInt(Date.now()),
        arrivalTime: BigInt(Date.now() + 3600000),
        duration: BigInt(60),
        price: BigInt(200),
        stops: BigInt(0),
        aircraftType: 'Boeing 737'
      });
    } catch (error) {
      console.error('Error adding flight:', error);
      toast.error('Failed to add flight');
    }
  };

  const handleDeleteFlight = async (flightNumber: string) => {
    try {
      await deleteFlight.mutateAsync(flightNumber);
      toast.success('Flight deleted successfully');
    } catch (error) {
      console.error('Error deleting flight:', error);
      toast.error('Failed to delete flight');
    }
  };

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Flight
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Flight</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Flight Number</Label>
                <Input
                  value={newFlight.flightNumber}
                  onChange={(e) => setNewFlight({ ...newFlight, flightNumber: e.target.value })}
                  placeholder="AA123"
                />
              </div>
              <div className="space-y-2">
                <Label>Airline</Label>
                <Input
                  value={newFlight.airline}
                  onChange={(e) => setNewFlight({ ...newFlight, airline: e.target.value })}
                  placeholder="American Airlines"
                />
              </div>
              <div className="space-y-2">
                <Label>Origin</Label>
                <Input
                  value={newFlight.origin}
                  onChange={(e) => setNewFlight({ ...newFlight, origin: e.target.value })}
                  placeholder="New York"
                />
              </div>
              <div className="space-y-2">
                <Label>Destination</Label>
                <Input
                  value={newFlight.destination}
                  onChange={(e) => setNewFlight({ ...newFlight, destination: e.target.value })}
                  placeholder="Los Angeles"
                />
              </div>
              <div className="space-y-2">
                <Label>Price ($)</Label>
                <Input
                  type="number"
                  value={Number(newFlight.price)}
                  onChange={(e) => setNewFlight({ ...newFlight, price: BigInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Input
                  type="number"
                  value={Number(newFlight.duration)}
                  onChange={(e) => setNewFlight({ ...newFlight, duration: BigInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Aircraft Type</Label>
                <Input
                  value={newFlight.aircraftType}
                  onChange={(e) => setNewFlight({ ...newFlight, aircraftType: e.target.value })}
                  placeholder="Boeing 737"
                />
              </div>
              <div className="space-y-2">
                <Label>Stops</Label>
                <Input
                  type="number"
                  value={Number(newFlight.stops)}
                  onChange={(e) => setNewFlight({ ...newFlight, stops: BigInt(e.target.value) })}
                />
              </div>
            </div>
            <Button onClick={handleAddFlight} disabled={addFlight.isPending} className="w-full bg-blue-600 hover:bg-blue-700">
              {addFlight.isPending ? 'Adding...' : 'Add Flight'}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Flights</CardTitle>
        </CardHeader>
        <CardContent>
          {flightsLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : !flights || flights.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No flights available</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Flight Number</TableHead>
                  <TableHead>Airline</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Available Seats</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flights.map((flight) => (
                  <TableRow key={flight.flightNumber}>
                    <TableCell className="font-medium">{flight.flightNumber}</TableCell>
                    <TableCell>{flight.airline}</TableCell>
                    <TableCell>
                      {flight.origin} → {flight.destination}
                    </TableCell>
                    <TableCell>${Number(flight.price)}</TableCell>
                    <TableCell>{Number(flight.seatAvailability.available)}</TableCell>
                    <TableCell>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteFlight(flight.flightNumber)}
                        disabled={deleteFlight.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
