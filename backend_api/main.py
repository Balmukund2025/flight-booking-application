from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator, Literal
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse
from uuid import uuid4

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

TripType = Literal["oneWay", "roundTrip"]
SeatType = Literal["economy", "premiumEconomy", "business", "premiumEconomyWindow", "businessPremium"]
BookingStatus = Literal["pending", "confirmed", "cancelled", "checkedIn"]

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "flight_booking.db"


class PriceRange(BaseModel):
    low: int
    medium: int
    high: int


class SeatAvailability(BaseModel):
    available: int
    occupied: int


class Seat(BaseModel):
    row: int
    column: int
    isWindow: bool
    isAisle: bool
    isPremium: bool
    isOccupied: bool


class SeatMap(BaseModel):
    seats: list[Seat]
    rows: int
    columns: int


class Flight(BaseModel):
    flightNumber: str
    airline: str
    origin: str
    destination: str
    departureTime: int
    arrivalTime: int
    duration: int
    price: int
    priceRange: PriceRange
    stops: int
    seatAvailability: SeatAvailability
    seats: SeatMap | None = None
    aircraftType: str


class PassengerDetail(BaseModel):
    name: str
    age: int
    seatPreference: int
    seatType: SeatType
    seatNumber: tuple[int, int] | None = None


class SeatSelection(BaseModel):
    seatNumber: tuple[int, int]
    seatType: SeatType
    priceModifier: float


class SearchCriteria(BaseModel):
    origin: str
    destination: str
    departureDate: int
    returnDate: int | None = None
    passengers: int
    tripType: TripType


class FlightFilters(BaseModel):
    airline: str | None = None
    priceRange: int | None = None
    durationRange: int | None = None
    departureTimeRange: tuple[int, int] | None = None
    arrivalTimeRange: tuple[int, int] | None = None
    stops: int | None = None


class SearchFlightsRequest(BaseModel):
    criteria: SearchCriteria
    filters: FlightFilters | None = None


class StripeConfiguration(BaseModel):
    secretKey: str
    allowedCountries: list[str]


class ShoppingItem(BaseModel):
    currency: str
    productName: str
    productDescription: str
    priceInCents: int
    quantity: int


class PaymentFailed(BaseModel):
    type: Literal["failed"] = "failed"
    error: str


class PaymentCompleted(BaseModel):
    type: Literal["completed"] = "completed"
    response: str
    userPrincipal: str | None = None


PaymentStatus = PaymentFailed | PaymentCompleted


class Booking(BaseModel):
    bookingId: int
    user: str
    flight: Flight
    passengers: list[PassengerDetail]
    seats: list[SeatSelection]
    status: BookingStatus
    stripeSessionId: str
    paymentStatus: PaymentStatus


class BookingOutcome(BaseModel):
    booking: Booking
    confirmationMessage: str


class UserProfile(BaseModel):
    name: str
    email: str
    bookingHistory: list[Booking] = Field(default_factory=list)


class BookSeatsRequest(BaseModel):
    flightNumber: str
    passengers: list[PassengerDetail]
    seats: list[SeatSelection] = Field(default_factory=list)


class UpdateBookingStatusRequest(BaseModel):
    status: BookingStatus


class CheckoutSessionRequest(BaseModel):
    bookingId: int
    items: list[ShoppingItem]
    successUrl: str
    cancelUrl: str


class CompletePaymentRequest(BaseModel):
    bookingId: int
    sessionId: str


def unix_ms(year: int, month: int, day: int, hour: int, minute: int) -> int:
    return int(datetime(year, month, day, hour, minute, tzinfo=timezone.utc).timestamp() * 1000)


def create_seat_map(rows: int = 20, columns: int = 6) -> SeatMap:
    seats: list[Seat] = []
    for row in range(rows):
        for column in range(columns):
            seats.append(
                Seat(
                    row=row,
                    column=column,
                    isWindow=column in (0, columns - 1),
                    isAisle=column in (2, 3),
                    isPremium=row < 3,
                    isOccupied=False,
                )
            )
    return SeatMap(seats=seats, rows=rows, columns=columns)


def create_flight(
    flight_number: str,
    airline: str,
    origin: str,
    destination: str,
    departure_time: int,
    arrival_time: int,
    duration: int,
    price: int,
    stops: int,
    aircraft_type: str,
) -> Flight:
    seat_map = create_seat_map()
    return Flight(
        flightNumber=flight_number,
        airline=airline,
        origin=origin,
        destination=destination,
        departureTime=departure_time,
        arrivalTime=arrival_time,
        duration=duration,
        price=price,
        priceRange=PriceRange(low=price, medium=price + 120, high=price + 260),
        stops=stops,
        seatAvailability=SeatAvailability(available=len(seat_map.seats), occupied=0),
        seats=seat_map,
        aircraftType=aircraft_type,
    )


SEEDED_FLIGHTS = [
    create_flight("SB101", "SkyBooker Air", "New York", "Los Angeles", unix_ms(2026, 4, 15, 9, 0), unix_ms(2026, 4, 15, 12, 30), 360, 320, 0, "Airbus A321"),
    create_flight("SB202", "Atlantic Connect", "New York", "London", unix_ms(2026, 4, 16, 14, 0), unix_ms(2026, 4, 16, 21, 30), 450, 640, 0, "Boeing 787-9"),
    create_flight("SB303", "Gulf Horizon", "Mumbai", "Dubai", unix_ms(2026, 4, 18, 8, 15), unix_ms(2026, 4, 18, 11, 45), 210, 210, 0, "Airbus A320neo"),
    create_flight("SB404", "Europa Wings", "Paris", "Singapore", unix_ms(2026, 4, 19, 6, 0), unix_ms(2026, 4, 19, 17, 0), 660, 780, 1, "Boeing 777-300ER"),
]


def connect() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


@contextmanager
def transaction() -> Iterator[sqlite3.Connection]:
    connection = connect()
    try:
        connection.execute("BEGIN IMMEDIATE")
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def dump_model(model: BaseModel) -> str:
    return model.model_dump_json()


def load_model(model_type: type[BaseModel], raw: str) -> BaseModel:
    return model_type.model_validate_json(raw)


def initialize_database() -> None:
    BASE_DIR.mkdir(parents=True, exist_ok=True)
    with connect() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS flights (
                flight_number TEXT PRIMARY KEY,
                origin TEXT NOT NULL,
                destination TEXT NOT NULL,
                departure_time INTEGER NOT NULL,
                data TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                role TEXT NOT NULL,
                profile_data TEXT
            );

            CREATE TABLE IF NOT EXISTS bookings (
                booking_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                flight_number TEXT NOT NULL,
                status TEXT NOT NULL,
                data TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS app_state (
                key TEXT PRIMARY KEY,
                value TEXT
            );
            """
        )

        flight_count = connection.execute("SELECT COUNT(*) FROM flights").fetchone()[0]
        if flight_count == 0:
            for flight in SEEDED_FLIGHTS:
                connection.execute(
                    """
                    INSERT INTO flights (flight_number, origin, destination, departure_time, data)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        flight.flightNumber,
                        flight.origin,
                        flight.destination,
                        flight.departureTime,
                        dump_model(flight),
                    ),
                )


def load_flight(connection: sqlite3.Connection, flight_number: str) -> Flight | None:
    row = connection.execute("SELECT data FROM flights WHERE flight_number = ?", (flight_number,)).fetchone()
    if not row:
        return None
    return load_model(Flight, row["data"])  # type: ignore[return-value]


def save_flight(connection: sqlite3.Connection, flight: Flight) -> None:
    connection.execute(
        """
        INSERT INTO flights (flight_number, origin, destination, departure_time, data)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(flight_number) DO UPDATE SET
            origin = excluded.origin,
            destination = excluded.destination,
            departure_time = excluded.departure_time,
            data = excluded.data
        """,
        (
            flight.flightNumber,
            flight.origin,
            flight.destination,
            flight.departureTime,
            dump_model(flight),
        ),
    )


def load_booking(connection: sqlite3.Connection, booking_id: int) -> Booking | None:
    row = connection.execute("SELECT data FROM bookings WHERE booking_id = ?", (booking_id,)).fetchone()
    if not row:
        return None
    return load_model(Booking, row["data"])  # type: ignore[return-value]


def save_booking(connection: sqlite3.Connection, booking: Booking) -> None:
    connection.execute(
        """
        INSERT INTO bookings (booking_id, user_id, flight_number, status, data)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(booking_id) DO UPDATE SET
            user_id = excluded.user_id,
            flight_number = excluded.flight_number,
            status = excluded.status,
            data = excluded.data
        """,
        (
            booking.bookingId,
            booking.user,
            booking.flight.flightNumber,
            booking.status,
            dump_model(booking),
        ),
    )


def delete_flight_row(connection: sqlite3.Connection, flight_number: str) -> bool:
    result = connection.execute("DELETE FROM flights WHERE flight_number = ?", (flight_number,))
    return result.rowcount > 0


def ensure_user(connection: sqlite3.Connection, user_id: str | None, required: bool = True) -> tuple[str | None, str | None]:
    if not user_id:
        if required:
            raise HTTPException(status_code=401, detail="Login required")
        return None, None

    row = connection.execute("SELECT role FROM users WHERE user_id = ?", (user_id,)).fetchone()
    if row:
        return user_id, row["role"]

    existing_users = connection.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    role = "admin" if existing_users == 0 else "user"
    connection.execute("INSERT INTO users (user_id, role, profile_data) VALUES (?, ?, NULL)", (user_id, role))
    return user_id, role


def require_admin(connection: sqlite3.Connection, user_id: str | None) -> tuple[str, str]:
    resolved_user_id, role = ensure_user(connection, user_id)
    assert resolved_user_id is not None and role is not None
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return resolved_user_id, role


def get_user_profile(connection: sqlite3.Connection, user_id: str) -> UserProfile | None:
    row = connection.execute("SELECT profile_data FROM users WHERE user_id = ?", (user_id,)).fetchone()
    if not row or row["profile_data"] is None:
        return None
    profile = load_model(UserProfile, row["profile_data"])  # type: ignore[assignment]
    assert isinstance(profile, UserProfile)
    return profile


def set_user_profile(connection: sqlite3.Connection, user_id: str, profile: UserProfile) -> None:
    connection.execute("UPDATE users SET profile_data = ? WHERE user_id = ?", (dump_model(profile), user_id))


def get_payment_configuration(connection: sqlite3.Connection) -> StripeConfiguration | None:
    row = connection.execute("SELECT value FROM app_state WHERE key = 'payment_configuration'").fetchone()
    if not row or row["value"] is None:
        return None
    configuration = load_model(StripeConfiguration, row["value"])
    assert isinstance(configuration, StripeConfiguration)
    return configuration


def set_payment_configuration(connection: sqlite3.Connection, configuration: StripeConfiguration) -> None:
    connection.execute(
        """
        INSERT INTO app_state (key, value) VALUES ('payment_configuration', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        """,
        (dump_model(configuration),),
    )


def list_user_bookings(connection: sqlite3.Connection, user_id: str) -> list[Booking]:
    rows = connection.execute("SELECT data FROM bookings WHERE user_id = ? ORDER BY booking_id", (user_id,)).fetchall()
    return [load_model(Booking, row["data"]) for row in rows]  # type: ignore[list-item]


def list_all_bookings(connection: sqlite3.Connection) -> list[Booking]:
    rows = connection.execute("SELECT data FROM bookings ORDER BY booking_id").fetchall()
    return [load_model(Booking, row["data"]) for row in rows]  # type: ignore[list-item]


def update_seat_occupancy(flight: Flight) -> None:
    if not flight.seats:
        return
    occupied = sum(1 for seat in flight.seats.seats if seat.isOccupied)
    total = len(flight.seats.seats)
    flight.seatAvailability = SeatAvailability(available=total - occupied, occupied=occupied)


def reserve_seats(flight: Flight, selected_seats: list[SeatSelection]) -> None:
    if not flight.seats:
        return
    seat_lookup = {(seat.row, seat.column): seat for seat in flight.seats.seats}
    for selection in selected_seats:
        seat = seat_lookup.get(selection.seatNumber)
        if not seat:
            raise HTTPException(status_code=400, detail=f"Seat {selection.seatNumber} does not exist")
        if seat.isOccupied:
            raise HTTPException(status_code=409, detail=f"Seat {selection.seatNumber} is already occupied")
    for selection in selected_seats:
        seat_lookup[selection.seatNumber].isOccupied = True
    update_seat_occupancy(flight)


def release_seats(flight: Flight, selected_seats: list[SeatSelection]) -> None:
    if not flight.seats:
        return
    seat_lookup = {(seat.row, seat.column): seat for seat in flight.seats.seats}
    for selection in selected_seats:
        seat = seat_lookup.get(selection.seatNumber)
        if seat:
            seat.isOccupied = False
    update_seat_occupancy(flight)


def flight_matches_filters(flight: Flight, filters: FlightFilters | None) -> bool:
    if not filters:
        return True
    if filters.airline and flight.airline != filters.airline:
        return False
    if filters.priceRange is not None and flight.price > filters.priceRange:
        return False
    if filters.durationRange is not None and flight.duration > filters.durationRange:
        return False
    if filters.departureTimeRange and not (filters.departureTimeRange[0] <= flight.departureTime <= filters.departureTimeRange[1]):
        return False
    if filters.arrivalTimeRange and not (filters.arrivalTimeRange[0] <= flight.arrivalTime <= filters.arrivalTimeRange[1]):
        return False
    if filters.stops is not None and flight.stops != filters.stops:
        return False
    return True


def append_session_id(success_url: str, session_id: str) -> str:
    parsed = urlparse(success_url)
    query = dict(parse_qsl(parsed.query))
    query["session_id"] = session_id
    return urlunparse(parsed._replace(query=urlencode(query)))


def attach_booking_history(connection: sqlite3.Connection, profile: UserProfile, user_id: str) -> UserProfile:
    profile.bookingHistory = list_user_bookings(connection, user_id)
    return profile


app = FastAPI(title="Flight Booking API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

initialize_database()


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/flights", response_model=list[Flight])
def get_all_flights() -> list[Flight]:
    with connect() as connection:
        rows = connection.execute(
            "SELECT data FROM flights ORDER BY origin, destination, departure_time"
        ).fetchall()
        return [load_model(Flight, row["data"]) for row in rows]  # type: ignore[list-item]


@app.post("/api/flights/search", response_model=list[Flight])
def search_flights(request: SearchFlightsRequest) -> list[Flight]:
    with connect() as connection:
        rows = connection.execute(
            """
            SELECT data FROM flights
            WHERE origin = ? AND destination = ? AND departure_time >= ?
            ORDER BY departure_time
            """,
            (request.criteria.origin, request.criteria.destination, request.criteria.departureDate),
        ).fetchall()
        flights = [load_model(Flight, row["data"]) for row in rows]  # type: ignore[list-item]
        matches = [flight for flight in flights if flight_matches_filters(flight, request.filters)]
        matches.sort(key=lambda item: item.price)
        return matches


@app.get("/api/flights/{flight_number}", response_model=Flight)
def get_flight(flight_number: str) -> Flight:
    with connect() as connection:
        flight = load_flight(connection, flight_number)
        if not flight:
            raise HTTPException(status_code=404, detail="Flight not found")
        return flight


@app.get("/api/flights/{flight_number}/seat-map", response_model=SeatMap)
def get_seat_map(flight_number: str) -> SeatMap:
    with connect() as connection:
        flight = load_flight(connection, flight_number)
        if not flight:
            raise HTTPException(status_code=404, detail="Flight not found")
        if not flight.seats:
            raise HTTPException(status_code=404, detail="Seat map not available")
        return flight.seats


@app.get("/api/users/me", response_model=UserProfile | None)
def get_current_user_profile(x_user_id: str | None = Header(default=None)) -> UserProfile | None:
    with transaction() as connection:
        user_id, _ = ensure_user(connection, x_user_id)
        assert user_id is not None
        profile = get_user_profile(connection, user_id)
        return attach_booking_history(connection, profile, user_id) if profile else None


@app.put("/api/users/me")
def save_current_user_profile(profile: UserProfile, x_user_id: str | None = Header(default=None)) -> dict[str, bool]:
    with transaction() as connection:
        user_id, _ = ensure_user(connection, x_user_id)
        assert user_id is not None
        set_user_profile(connection, user_id, attach_booking_history(connection, profile, user_id))
        return {"saved": True}


@app.get("/api/users/me/admin-status")
def get_admin_status(x_user_id: str | None = Header(default=None)) -> dict[str, bool]:
    with transaction() as connection:
        _, role = ensure_user(connection, x_user_id, required=False)
        return {"isAdmin": role == "admin"}


@app.get("/api/bookings/me", response_model=list[Booking])
def get_my_bookings(x_user_id: str | None = Header(default=None)) -> list[Booking]:
    with transaction() as connection:
        user_id, _ = ensure_user(connection, x_user_id)
        assert user_id is not None
        return list_user_bookings(connection, user_id)


@app.get("/api/bookings/{booking_id}", response_model=Booking)
def get_booking(booking_id: int, x_user_id: str | None = Header(default=None)) -> Booking:
    with transaction() as connection:
        user_id, role = ensure_user(connection, x_user_id)
        assert user_id is not None and role is not None
        booking = load_booking(connection, booking_id)
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        if booking.user != user_id and role != "admin":
            raise HTTPException(status_code=403, detail="Unauthorized")
        return booking


@app.post("/api/bookings", response_model=BookingOutcome)
def create_booking(request: BookSeatsRequest, x_user_id: str | None = Header(default=None)) -> BookingOutcome:
    with transaction() as connection:
        user_id, _ = ensure_user(connection, x_user_id)
        assert user_id is not None
        flight = load_flight(connection, request.flightNumber)
        if not flight:
            raise HTTPException(status_code=404, detail="Flight not found")
        reserve_seats(flight, request.seats)
        save_flight(connection, flight)

        booking_id = connection.execute(
            "INSERT INTO bookings (user_id, flight_number, status, data) VALUES (?, ?, ?, ?)",
            (user_id, request.flightNumber, "pending", "{}"),
        ).lastrowid
        assert booking_id is not None

        booking = Booking(
            bookingId=booking_id,
            user=user_id,
            flight=flight,
            passengers=request.passengers,
            seats=request.seats,
            status="pending",
            stripeSessionId="",
            paymentStatus=PaymentFailed(error="No payment yet"),
        )
        save_booking(connection, booking)

        profile = get_user_profile(connection, user_id)
        if profile:
            set_user_profile(connection, user_id, attach_booking_history(connection, profile, user_id))

        return BookingOutcome(
            booking=booking,
            confirmationMessage="Booking created successfully. Please proceed to payment.",
        )


@app.patch("/api/bookings/{booking_id}/status", response_model=Booking)
def update_booking_status(
    booking_id: int, payload: UpdateBookingStatusRequest, x_user_id: str | None = Header(default=None)
) -> Booking:
    with transaction() as connection:
        user_id, role = ensure_user(connection, x_user_id)
        assert user_id is not None and role is not None
        booking = load_booking(connection, booking_id)
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        if booking.user != user_id and role != "admin":
            raise HTTPException(status_code=403, detail="Unauthorized")

        if payload.status == "cancelled" and booking.status != "cancelled":
            flight = load_flight(connection, booking.flight.flightNumber)
            if flight:
                release_seats(flight, booking.seats)
                save_flight(connection, flight)
                booking.flight = flight

        booking.status = payload.status
        save_booking(connection, booking)
        return booking


@app.get("/api/payments/configuration/status")
def stripe_configuration_status() -> dict[str, bool]:
    with connect() as connection:
        return {"configured": get_payment_configuration(connection) is not None}


@app.post("/api/payments/configuration")
def set_payment_configuration_endpoint(
    config: StripeConfiguration, x_user_id: str | None = Header(default=None)
) -> dict[str, bool]:
    with transaction() as connection:
        require_admin(connection, x_user_id)
        set_payment_configuration(connection, config)
        return {"saved": True}


@app.post("/api/payments/checkout-session")
def create_checkout_session(request: CheckoutSessionRequest, x_user_id: str | None = Header(default=None)) -> dict[str, str]:
    with transaction() as connection:
        user_id, role = ensure_user(connection, x_user_id)
        assert user_id is not None and role is not None
        booking = load_booking(connection, request.bookingId)
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        if booking.user != user_id and role != "admin":
            raise HTTPException(status_code=403, detail="Unauthorized")

        session_id = f"local-session-{uuid4().hex[:12]}"
        return {"id": session_id, "url": append_session_id(request.successUrl, session_id)}


@app.post("/api/payments/complete", response_model=Booking)
def complete_payment(request: CompletePaymentRequest, x_user_id: str | None = Header(default=None)) -> Booking:
    with transaction() as connection:
        user_id, role = ensure_user(connection, x_user_id)
        assert user_id is not None and role is not None
        booking = load_booking(connection, request.bookingId)
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        if booking.user != user_id and role != "admin":
            raise HTTPException(status_code=403, detail="Unauthorized")

        booking.stripeSessionId = request.sessionId
        booking.status = "confirmed"
        booking.paymentStatus = PaymentCompleted(
            response="Local payment completed successfully",
            userPrincipal=user_id,
        )
        save_booking(connection, booking)

        profile = get_user_profile(connection, user_id)
        if profile:
            set_user_profile(connection, user_id, attach_booking_history(connection, profile, user_id))

        return booking


@app.get("/api/admin/bookings", response_model=list[Booking])
def get_admin_bookings(x_user_id: str | None = Header(default=None)) -> list[Booking]:
    with transaction() as connection:
        require_admin(connection, x_user_id)
        return list_all_bookings(connection)


@app.post("/api/admin/flights")
def add_flight(flight: Flight, x_user_id: str | None = Header(default=None)) -> dict[str, bool]:
    with transaction() as connection:
        require_admin(connection, x_user_id)
        save_flight(connection, flight)
        return {"saved": True}


@app.put("/api/admin/flights/{flight_number}")
def update_flight(flight_number: str, flight: Flight, x_user_id: str | None = Header(default=None)) -> dict[str, bool]:
    with transaction() as connection:
        require_admin(connection, x_user_id)
        if flight_number != flight.flightNumber:
            raise HTTPException(status_code=400, detail="Flight number mismatch")
        save_flight(connection, flight)
        return {"saved": True}


@app.delete("/api/admin/flights/{flight_number}")
def delete_flight(flight_number: str, x_user_id: str | None = Header(default=None)) -> dict[str, bool]:
    with transaction() as connection:
        require_admin(connection, x_user_id)
        return {"deleted": delete_flight_row(connection, flight_number)}
