export const TripType = {
  oneWay: 'oneWay',
  roundTrip: 'roundTrip'
} as const;

export type TripType = (typeof TripType)[keyof typeof TripType];

export const SeatType = {
  economy: 'economy',
  premiumEconomy: 'premiumEconomy',
  business: 'business',
  premiumEconomyWindow: 'premiumEconomyWindow',
  businessPremium: 'businessPremium'
} as const;

export type SeatType = (typeof SeatType)[keyof typeof SeatType];

export const BookingStatus = {
  pending: 'pending',
  confirmed: 'confirmed',
  cancelled: 'cancelled',
  checkedIn: 'checkedIn'
} as const;

export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

export type SearchCriteria = {
  origin: string;
  destination: string;
  departureDate: bigint;
  returnDate?: bigint;
  passengers: bigint;
  tripType: TripType;
};

export type Seat = {
  row: bigint;
  column: bigint;
  isWindow: boolean;
  isAisle: boolean;
  isPremium: boolean;
  isOccupied: boolean;
};

export type SeatMap = {
  seats: Seat[];
  rows: bigint;
  columns: bigint;
};

export type SeatSelection = {
  seatNumber: [bigint, bigint];
  seatType: SeatType;
  priceModifier: number;
};

export type SeatAvailability = {
  available: bigint;
  occupied: bigint;
};

export type PriceRange = {
  low: bigint;
  medium: bigint;
  high: bigint;
};

export type Flight = {
  flightNumber: string;
  airline: string;
  origin: string;
  destination: string;
  departureTime: bigint;
  arrivalTime: bigint;
  duration: bigint;
  price: bigint;
  priceRange: PriceRange;
  stops: bigint;
  seatAvailability: SeatAvailability;
  seats?: SeatMap;
  aircraftType: string;
};

export type PassengerDetail = {
  name: string;
  age: bigint;
  seatPreference: bigint;
  seatType: SeatType;
  seatNumber?: [bigint, bigint];
};

export type StripeSessionStatus =
  | { type: 'failed'; error: string }
  | { type: 'completed'; response: string; userPrincipal?: string };

export type Booking = {
  bookingId: bigint;
  user: string;
  flight: Flight;
  passengers: PassengerDetail[];
  seats: SeatSelection[];
  status: BookingStatus;
  stripeSessionId: string;
  paymentStatus: StripeSessionStatus;
};

export type UserProfile = {
  name: string;
  email: string;
  bookingHistory: Booking[];
};

export type FlightFilters = {
  airline?: string;
  priceRange?: bigint;
  durationRange?: bigint;
  departureTimeRange?: [bigint, bigint];
  arrivalTimeRange?: [bigint, bigint];
  stops?: bigint;
};

export type BookingOutcome = {
  booking: Booking;
  confirmationMessage: string;
};

export type StripeConfiguration = {
  secretKey: string;
  allowedCountries: string[];
};

export type ShoppingItem = {
  currency: string;
  productName: string;
  productDescription: string;
  priceInCents: bigint;
  quantity: bigint;
};
