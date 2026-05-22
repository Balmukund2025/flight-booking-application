import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useInternetIdentity } from './useInternetIdentity';
import type {
  Booking,
  BookingOutcome,
  BookingStatus,
  Flight,
  FlightFilters,
  PassengerDetail,
  SearchCriteria,
  SeatMap,
  SeatSelection,
  ShoppingItem,
  StripeConfiguration,
  UserProfile
} from '../backend';

type ApiSeat = {
  row: number;
  column: number;
  isWindow: boolean;
  isAisle: boolean;
  isPremium: boolean;
  isOccupied: boolean;
};

type ApiSeatMap = {
  seats: ApiSeat[];
  rows: number;
  columns: number;
};

type ApiFlight = {
  flightNumber: string;
  airline: string;
  origin: string;
  destination: string;
  departureTime: number;
  arrivalTime: number;
  duration: number;
  price: number;
  priceRange: { low: number; medium: number; high: number };
  stops: number;
  seatAvailability: { available: number; occupied: number };
  seats?: ApiSeatMap;
  aircraftType: string;
};

type ApiPassengerDetail = {
  name: string;
  age: number;
  seatPreference: number;
  seatType: PassengerDetail['seatType'];
  seatNumber?: [number, number];
};

type ApiSeatSelection = {
  seatNumber: [number, number];
  seatType: SeatSelection['seatType'];
  priceModifier: number;
};

type ApiBooking = {
  bookingId: number;
  user: string;
  flight: ApiFlight;
  passengers: ApiPassengerDetail[];
  seats: ApiSeatSelection[];
  status: BookingStatus;
  stripeSessionId: string;
  paymentStatus: { type: 'failed'; error: string } | { type: 'completed'; response: string; userPrincipal?: string };
};

type ApiBookingOutcome = {
  booking: ApiBooking;
  confirmationMessage: string;
};

type ApiSearchCriteria = {
  origin: string;
  destination: string;
  departureDate: number;
  returnDate?: number;
  passengers: number;
  tripType: SearchCriteria['tripType'];
};

type ApiFlightFilters = {
  airline?: string;
  priceRange?: number;
  durationRange?: number;
  departureTimeRange?: [number, number];
  arrivalTimeRange?: [number, number];
  stops?: number;
};

const toBigInt = (value: number) => BigInt(value);
const toNumber = (value: bigint) => Number(value);

const fromSeatMap = (seatMap: ApiSeatMap): SeatMap => ({
  rows: toBigInt(seatMap.rows),
  columns: toBigInt(seatMap.columns),
  seats: seatMap.seats.map((seat) => ({
    ...seat,
    row: toBigInt(seat.row),
    column: toBigInt(seat.column)
  }))
});

const toSeatMap = (seatMap: SeatMap): ApiSeatMap => ({
  rows: toNumber(seatMap.rows),
  columns: toNumber(seatMap.columns),
  seats: seatMap.seats.map((seat) => ({
    ...seat,
    row: toNumber(seat.row),
    column: toNumber(seat.column)
  }))
});

const fromFlight = (flight: ApiFlight): Flight => ({
  ...flight,
  departureTime: toBigInt(flight.departureTime),
  arrivalTime: toBigInt(flight.arrivalTime),
  duration: toBigInt(flight.duration),
  price: toBigInt(flight.price),
  priceRange: {
    low: toBigInt(flight.priceRange.low),
    medium: toBigInt(flight.priceRange.medium),
    high: toBigInt(flight.priceRange.high)
  },
  stops: toBigInt(flight.stops),
  seatAvailability: {
    available: toBigInt(flight.seatAvailability.available),
    occupied: toBigInt(flight.seatAvailability.occupied)
  },
  seats: flight.seats ? fromSeatMap(flight.seats) : undefined
});

const toFlight = (flight: Flight): ApiFlight => ({
  ...flight,
  departureTime: toNumber(flight.departureTime),
  arrivalTime: toNumber(flight.arrivalTime),
  duration: toNumber(flight.duration),
  price: toNumber(flight.price),
  priceRange: {
    low: toNumber(flight.priceRange.low),
    medium: toNumber(flight.priceRange.medium),
    high: toNumber(flight.priceRange.high)
  },
  stops: toNumber(flight.stops),
  seatAvailability: {
    available: toNumber(flight.seatAvailability.available),
    occupied: toNumber(flight.seatAvailability.occupied)
  },
  seats: flight.seats ? toSeatMap(flight.seats) : undefined
});

const fromPassenger = (passenger: ApiPassengerDetail): PassengerDetail => ({
  ...passenger,
  age: toBigInt(passenger.age),
  seatPreference: toBigInt(passenger.seatPreference),
  seatNumber: passenger.seatNumber ? [toBigInt(passenger.seatNumber[0]), toBigInt(passenger.seatNumber[1])] : undefined
});

const toPassenger = (passenger: PassengerDetail): ApiPassengerDetail => ({
  ...passenger,
  age: toNumber(passenger.age),
  seatPreference: toNumber(passenger.seatPreference),
  seatNumber: passenger.seatNumber ? [toNumber(passenger.seatNumber[0]), toNumber(passenger.seatNumber[1])] : undefined
});

const fromSeatSelection = (seat: ApiSeatSelection): SeatSelection => ({
  ...seat,
  seatNumber: [toBigInt(seat.seatNumber[0]), toBigInt(seat.seatNumber[1])]
});

const toSeatSelection = (seat: SeatSelection): ApiSeatSelection => ({
  ...seat,
  seatNumber: [toNumber(seat.seatNumber[0]), toNumber(seat.seatNumber[1])]
});

const fromBooking = (booking: ApiBooking): Booking => ({
  ...booking,
  bookingId: toBigInt(booking.bookingId),
  flight: fromFlight(booking.flight),
  passengers: booking.passengers.map(fromPassenger),
  seats: booking.seats.map(fromSeatSelection)
});

const toSearchCriteria = (criteria: SearchCriteria): ApiSearchCriteria => ({
  ...criteria,
  departureDate: toNumber(criteria.departureDate),
  returnDate: criteria.returnDate ? toNumber(criteria.returnDate) : undefined,
  passengers: toNumber(criteria.passengers)
});

const toFlightFilters = (filters?: FlightFilters | null): ApiFlightFilters | undefined =>
  filters
    ? {
        airline: filters.airline,
        priceRange: filters.priceRange !== undefined ? toNumber(filters.priceRange) : undefined,
        durationRange: filters.durationRange !== undefined ? toNumber(filters.durationRange) : undefined,
        departureTimeRange: filters.departureTimeRange
          ? [toNumber(filters.departureTimeRange[0]), toNumber(filters.departureTimeRange[1])]
          : undefined,
        arrivalTimeRange: filters.arrivalTimeRange
          ? [toNumber(filters.arrivalTimeRange[0]), toNumber(filters.arrivalTimeRange[1])]
          : undefined,
        stops: filters.stops !== undefined ? toNumber(filters.stops) : undefined
      }
    : undefined;

const apiFetch = async <T>(
  path: string,
  options: { method?: string; body?: unknown; userId?: string | null } = {}
): Promise<T> => {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.userId) headers['X-User-Id'] = options.userId;

  const response = await fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    const rawBody = await response.text();
    if (rawBody) {
      try {
        const errorBody = JSON.parse(rawBody) as { detail?: string };
        if (errorBody.detail) {
          message = errorBody.detail;
        } else {
          message = rawBody;
        }
      } catch {
        message = rawBody;
      }
    }
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
};

export function useGetCallerUserProfile() {
  const { identity } = useInternetIdentity();

  const query = useQuery<UserProfile | null>({
    queryKey: ['currentUserProfile', identity?.userId],
    queryFn: async () => {
      if (!identity) return null;
      return apiFetch<UserProfile | null>('/users/me', { userId: identity.userId });
    },
    enabled: !!identity,
    retry: false
  });

  return {
    ...query,
    isFetched: !!identity && query.isFetched
  };
}

export function useSaveCallerUserProfile() {
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profile: UserProfile) => {
      if (!identity) throw new Error('User not available');
      return apiFetch<void>('/users/me', { method: 'PUT', body: profile, userId: identity.userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
    }
  });
}

export function useSearchFlights() {
  return useMutation({
    mutationFn: async ({ criteria, filters }: { criteria: SearchCriteria; filters?: FlightFilters | null }) => {
      const result = await apiFetch<ApiFlight[]>('/flights/search', {
        method: 'POST',
        body: { criteria: toSearchCriteria(criteria), filters: toFlightFilters(filters) }
      });
      return result.map(fromFlight);
    }
  });
}

export function useGetAllFlights() {
  return useQuery<Flight[]>({
    queryKey: ['allFlights'],
    queryFn: async () => (await apiFetch<ApiFlight[]>('/flights')).map(fromFlight)
  });
}

export function useGetFlight(flightNumber: string) {
  return useQuery<Flight>({
    queryKey: ['flight', flightNumber],
    queryFn: async () => fromFlight(await apiFetch<ApiFlight>(`/flights/${flightNumber}`)),
    enabled: !!flightNumber
  });
}

export function useGetSeatMap(flightNumber: string) {
  return useQuery<SeatMap>({
    queryKey: ['seatMap', flightNumber],
    queryFn: async () => fromSeatMap(await apiFetch<ApiSeatMap>(`/flights/${flightNumber}/seat-map`)),
    enabled: !!flightNumber
  });
}

export function useBookSeats() {
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      flightNumber,
      passengers,
      seats
    }: {
      flightNumber: string;
      passengers: PassengerDetail[];
      seats?: SeatSelection[] | null;
    }) => {
      if (!identity) throw new Error('User not available');
      const result = await apiFetch<ApiBookingOutcome>('/bookings', {
        method: 'POST',
        userId: identity.userId,
        body: {
          flightNumber,
          passengers: passengers.map(toPassenger),
          seats: seats?.map(toSeatSelection) ?? []
        }
      });
      return {
        booking: fromBooking(result.booking),
        confirmationMessage: result.confirmationMessage
      } satisfies BookingOutcome;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['allFlights'] });
    }
  });
}

export function useGetCallerBookings() {
  const { identity } = useInternetIdentity();

  return useQuery<Booking[]>({
    queryKey: ['bookings', identity?.userId],
    queryFn: async () => {
      if (!identity) return [];
      return (await apiFetch<ApiBooking[]>('/bookings/me', { userId: identity.userId })).map(fromBooking);
    },
    enabled: !!identity
  });
}

export function useGetBooking(bookingId: bigint | null) {
  const { identity } = useInternetIdentity();

  return useQuery<Booking>({
    queryKey: ['booking', bookingId?.toString(), identity?.userId],
    queryFn: async () => {
      if (!identity || bookingId === null) throw new Error('Booking not available');
      return fromBooking(await apiFetch<ApiBooking>(`/bookings/${bookingId.toString()}`, { userId: identity.userId }));
    },
    enabled: !!identity && bookingId !== null
  });
}

export function useIsStripeConfigured() {
  return useQuery<boolean>({
    queryKey: ['stripeConfigured'],
    queryFn: async () => (await apiFetch<{ configured: boolean }>('/payments/configuration/status')).configured
  });
}

export function useSetStripeConfiguration() {
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: StripeConfiguration) => {
      if (!identity) throw new Error('User not available');
      return apiFetch<void>('/payments/configuration', { method: 'POST', body: config, userId: identity.userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stripeConfigured'] });
    }
  });
}

export function useCreateStripeCheckoutSession() {
  const { identity } = useInternetIdentity();

  return useMutation({
    mutationFn: async ({
      bookingId,
      items,
      successUrl,
      cancelUrl
    }: {
      bookingId: bigint;
      items: ShoppingItem[];
      successUrl: string;
      cancelUrl: string;
    }) => {
      if (!identity) throw new Error('User not available');
      return apiFetch<{ id: string; url: string }>('/payments/checkout-session', {
        method: 'POST',
        userId: identity.userId,
        body: {
          bookingId: toNumber(bookingId),
          items: items.map((item) => ({
            ...item,
            priceInCents: toNumber(item.priceInCents),
            quantity: toNumber(item.quantity)
          })),
          successUrl,
          cancelUrl
        }
      });
    }
  });
}

export function useCompletePayment() {
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bookingId, sessionId }: { bookingId: bigint; sessionId: string }) => {
      if (!identity) throw new Error('User not available');
      return fromBooking(
        await apiFetch<ApiBooking>('/payments/complete', {
          method: 'POST',
          userId: identity.userId,
          body: { bookingId: toNumber(bookingId), sessionId }
        })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking'] });
    }
  });
}

export function useUpdateBookingStatus() {
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bookingId, status }: { bookingId: bigint; status: BookingStatus }) => {
      if (!identity) throw new Error('User not available');
      return fromBooking(
        await apiFetch<ApiBooking>(`/bookings/${bookingId.toString()}/status`, {
          method: 'PATCH',
          userId: identity.userId,
          body: { status }
        })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking'] });
    }
  });
}

export function useIsCallerAdmin() {
  const { identity } = useInternetIdentity();

  return useQuery<boolean>({
    queryKey: ['isAdmin', identity?.userId],
    queryFn: async () => {
      if (!identity) return false;
      return (await apiFetch<{ isAdmin: boolean }>('/users/me/admin-status', { userId: identity.userId })).isAdmin;
    }
  });
}

export function useAddFlight() {
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (flight: Flight) => {
      if (!identity) throw new Error('User not available');
      return apiFetch<void>('/admin/flights', { method: 'POST', body: toFlight(flight), userId: identity.userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allFlights'] });
    }
  });
}

export function useUpdateFlight() {
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (flight: Flight) => {
      if (!identity) throw new Error('User not available');
      return apiFetch<void>(`/admin/flights/${flight.flightNumber}`, {
        method: 'PUT',
        body: toFlight(flight),
        userId: identity.userId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allFlights'] });
    }
  });
}

export function useDeleteFlight() {
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (flightNumber: string) => {
      if (!identity) throw new Error('User not available');
      return apiFetch<{ deleted: boolean }>(`/admin/flights/${flightNumber}`, {
        method: 'DELETE',
        userId: identity.userId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allFlights'] });
    }
  });
}

export function useGetAdministrativeBookings() {
  const { identity } = useInternetIdentity();

  return useQuery<Booking[]>({
    queryKey: ['adminBookings', identity?.userId],
    queryFn: async () => {
      if (!identity) return [];
      return (await apiFetch<ApiBooking[]>('/admin/bookings', { userId: identity.userId })).map(fromBooking);
    },
    enabled: !!identity
  });
}
