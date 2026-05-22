import Map "mo:core/Map";
import Array "mo:core/Array";
import Nat "mo:core/Nat";
import Text "mo:core/Text";
import Int "mo:core/Int";
import Order "mo:core/Order";
import Runtime "mo:core/Runtime";
import List "mo:core/List";
import Principal "mo:core/Principal";
import Iter "mo:core/Iter";
import OutCall "./http-outcalls/outcall";
import AccessControl "authorization/access-control";
import MixinAuthorization "authorization/MixinAuthorization";
import Stripe "stripe/stripe";

actor {
  // ----- MODULES -----
  module Booking {
    public func compare(booking1 : Booking, booking2 : Booking) : Order.Order {
      Nat.compare(booking1.bookingId, booking2.bookingId);
    };
  };

  module Flight {
    public func compare(flight1 : Flight, flight2 : Flight) : Order.Order {
      switch (Text.compare(flight1.origin, flight2.origin)) {
        case (#equal) {
          switch (Text.compare(flight1.destination, flight2.destination)) {
            case (#equal) { Nat.compare(flight1.departureTime, flight2.departureTime) };
            case (order) { order };
          };
        };
        case (order) { order };
      };
    };
  };

  module UserProfile {
    public func compare(userProfile1 : UserProfile, userProfile2 : UserProfile) : Order.Order {
      Text.compare(userProfile1.email, userProfile2.email);
    };
  };

  // ----- TYPES -----
  public type SearchCriteria = {
    origin : Text;
    destination : Text;
    departureDate : Nat;
    returnDate : ?Nat;
    passengers : Nat;
    tripType : TripType;
  };

  public type TripType = {
    #oneWay;
    #roundTrip;
  };

  public type Seat = {
    row : Nat;
    column : Nat;
    isWindow : Bool;
    isAisle : Bool;
    isPremium : Bool;
    isOccupied : Bool;
  };

  public type SeatMap = {
    seats : [Seat];
    rows : Nat;
    columns : Nat;
  };

  public type SeatSelection = {
    seatNumber : (Nat, Nat);
    seatType : SeatType;
    priceModifier : Float;
  };

  public type SeatType = {
    #economy;
    #premiumEconomy;
    #business;
    #premiumEconomyWindow;
    #businessPremium;
  };

  public type SeatAvailability = {
    available : Nat;
    occupied : Nat;
  };

  public type Flight = {
    flightNumber : Text;
    airline : Text;
    origin : Text;
    destination : Text;
    departureTime : Nat;
    arrivalTime : Nat;
    duration : Nat;
    price : Nat;
    priceRange : PriceRange;
    stops : Nat;
    seatAvailability : SeatAvailability;
    seats : ?SeatMap;
    aircraftType : Text;
  };

  public type PriceRange = {
    low : Nat;
    medium : Nat;
    high : Nat;
  };

  public type PassengerDetail = {
    name : Text;
    age : Nat;
    seatPreference : Nat;
    seatType : SeatType;
    seatNumber : ?(Nat, Nat);
  };

  public type Booking = {
    bookingId : Nat;
    user : Principal;
    flight : Flight;
    passengers : [PassengerDetail];
    seats : [SeatSelection];
    status : BookingStatus;
    stripeSessionId : Text;
    paymentStatus : Stripe.StripeSessionStatus;
  };

  public type BookingStatus = {
    #pending;
    #confirmed;
    #cancelled;
    #checkedIn;
  };

  public type PaymentMethods = {
    stripe : Stripe.StripeConfiguration;
  };

  public type UserProfile = {
    name : Text;
    email : Text;
    bookingHistory : [Booking];
  };

  public type FlightFilters = {
    airline : ?Text;
    priceRange : ?Nat;
    durationRange : ?Nat;
    departureTimeRange : ?(Nat, Nat);
    arrivalTimeRange : ?(Nat, Nat);
    stops : ?Nat;
  };

  public type BookingOutcome = {
    booking : Booking;
    confirmationMessage : Text;
  };

  var nextBookingId = 1;

  let bookings = Map.empty<Nat, Booking>();

  let flights = Map.empty<Text, Flight>();

  let userProfiles = Map.empty<Principal, UserProfile>();

  // ----- AUTHORIZATION -----
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  var paymentMethods : ?PaymentMethods = null;

  func createSeatMap(rows : Nat, columns : Nat) : SeatMap {
    let seats = List.empty<Seat>();
    var row = 0;
    while (row < rows) {
      var column = 0;
      while (column < columns) {
        seats.add({
          row = row;
          column = column;
          isWindow = column == 0 or column == columns - 1;
          isAisle = column == 2 or column == 3;
          isPremium = row < 3;
          isOccupied = false;
        });
        column += 1;
      };
      row += 1;
    };
    {
      seats = seats.toArray();
      rows;
      columns;
    };
  };

  func createFlight(
    flightNumber : Text,
    airline : Text,
    origin : Text,
    destination : Text,
    departureTime : Nat,
    arrivalTime : Nat,
    duration : Nat,
    price : Nat,
    stops : Nat,
    aircraftType : Text
  ) : Flight {
    let seatMap = createSeatMap(20, 6);
    {
      flightNumber;
      airline;
      origin;
      destination;
      departureTime;
      arrivalTime;
      duration;
      price;
      priceRange = {
        low = price;
        medium = price + 120;
        high = price + 260;
      };
      stops;
      seatAvailability = {
        available = 120;
        occupied = 0;
      };
      seats = ?seatMap;
      aircraftType;
    };
  };

  do {
    flights.add(
      "SB101",
      createFlight(
        "SB101",
        "SkyBooker Air",
        "New York",
        "Los Angeles",
        1776243600000,
        1776256200000,
        360,
        320,
        0,
        "Airbus A321"
      )
    );
    flights.add(
      "SB202",
      createFlight(
        "SB202",
        "Atlantic Connect",
        "New York",
        "London",
        1776348000000,
        1776375000000,
        450,
        640,
        0,
        "Boeing 787-9"
      )
    );
    flights.add(
      "SB303",
      createFlight(
        "SB303",
        "Gulf Horizon",
        "Mumbai",
        "Dubai",
        1776500100000,
        1776512700000,
        210,
        210,
        0,
        "Airbus A320neo"
      )
    );
    flights.add(
      "SB404",
      createFlight(
        "SB404",
        "Europa Wings",
        "Paris",
        "Singapore",
        1776585600000,
        1776625200000,
        660,
        780,
        1,
        "Boeing 777-300ER"
      )
    );
  };

  // ========== USER PROFILE MANAGEMENT ==========

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  // ========== FLIGHT SEARCH & FILTERING ==========

  public query ({ caller }) func searchFlights(criteria : SearchCriteria, filters : ?FlightFilters) : async [Flight] {
    let allFlights = flights.values().toArray();
    let filteredFlights = allFlights.filter(
      func(flight) {
        flight.origin == criteria.origin and
        flight.destination == criteria.destination and
        flight.departureTime >= criteria.departureDate;
      }
    );

    applyFilters(filteredFlights, filters);
  };

  func applyFilters(flights : [Flight], filters : ?FlightFilters) : [Flight] {
    switch (filters) {
      case (null) { flights };
      case (?f) {
        flights.filter(
          func(flight) {
            let airlineMatch = switch (f.airline) {
              case (null) { true };
              case (?airline) { flight.airline == airline };
            };
            let priceMatch = switch (f.priceRange) {
              case (null) { true };
              case (?pRange) { flight.price >= pRange };
            };
            airlineMatch and priceMatch;
          }
        );
      };
    };
  };

  public query ({ caller }) func getFlight(flightNumber : Text) : async Flight {
    switch (flights.get(flightNumber)) {
      case (null) { Runtime.trap("Flight does not exist") };
      case (?flight) { flight };
    };
  };

  // ========== SEAT MAP & SEAT SELECTION ==========

  public query ({ caller }) func getSeatMap(flightNumber : Text) : async SeatMap {
    switch (flights.get(flightNumber)) {
      case (null) { Runtime.trap("Flight does not exist") };
      case (?flight) {
        switch (flight.seats) {
          case (null) { Runtime.trap("No seat map available") };
          case (?seatMap) { seatMap };
        };
      };
    };
  };

  public query ({ caller }) func checkSeatAvailability(flightNumber : Text, seatType : SeatType) : async SeatAvailability {
    switch (flights.get(flightNumber)) {
      case (null) { Runtime.trap("Flight does not exist") };
      case (?flight) { flight.seatAvailability };
    };
  };

  public shared ({ caller }) func bookSeats(flightNumber : Text, passengerDetails : [PassengerDetail], selectedSeats : ?[SeatSelection]) : async BookingOutcome {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can book seats");
    };

    let newBooking : Booking = {
      bookingId = nextBookingId;
      user = caller;
      flight = switch (flights.get(flightNumber)) {
        case (null) { Runtime.trap("Flight does not exist") };
        case (?flight) { flight };
      };
      passengers = passengerDetails;
      seats = switch (selectedSeats) {
        case (null) { [] };
        case (?seats) { seats };
      };
      status = #pending;
      stripeSessionId = "";
      paymentStatus = #failed({ error = "No payment yet" });
    };

    nextBookingId += 1;

    bookings.add(newBooking.bookingId, newBooking);

    {
      booking = newBooking;
      confirmationMessage = "Booking created successfully. Please proceed to payment.";
    };
  };

  // ========== PAYMENT PROCESSING ==========

  public shared ({ caller }) func setStripeConfiguration(config : Stripe.StripeConfiguration) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can perform this action");
    };
    paymentMethods := ?{ stripe = config };
  };

  func getStripeConfiguration() : Stripe.StripeConfiguration {
    switch (paymentMethods) {
      case (null) { Runtime.trap("Stripe needs to be first configured") };
      case (?{ stripe }) { stripe };
    };
  };

  public query ({ caller }) func isStripeConfigured() : async Bool {
    paymentMethods != null;
  };

  public shared ({ caller }) func createCheckoutSession(items : [Stripe.ShoppingItem], successUrl : Text, cancelUrl : Text) : async Text {
    await Stripe.createCheckoutSession(getStripeConfiguration(), caller, items, successUrl, cancelUrl, transform);
  };

  public shared ({ caller }) func getStripeSessionStatus(sessionId : Text) : async Stripe.StripeSessionStatus {
    await Stripe.getSessionStatus(getStripeConfiguration(), sessionId, transform);
  };

  public shared ({ caller }) func createStripeCheckoutSession(bookingId : Nat, items : [Stripe.ShoppingItem], successUrl : Text, cancelUrl : Text) : async Text {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can create checkout sessions");
    };

    let booking = switch (bookings.get(bookingId)) {
      case (null) { Runtime.trap("Booking does not exist") };
      case (?booking) { booking };
    };

    // Verify the caller owns this booking
    if (booking.user != caller and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only create checkout session for your own booking");
    };

    let session = await Stripe.createCheckoutSession(getStripeConfiguration(), booking.user, items, successUrl, cancelUrl, transform);
    session;
  };

  public shared ({ caller }) func completePayment(bookingId : Nat, sessionId : Text) : async Booking {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can complete payments");
    };

    let flightBooking = switch (bookings.get(bookingId)) {
      case (null) { Runtime.trap("Booking does not exist") };
      case (?b) { b };
    };

    // Verify the caller owns this booking
    if (flightBooking.user != caller and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only complete payment for your own booking");
    };

    let paymentStatus = await Stripe.getSessionStatus(getStripeConfiguration(), sessionId, transform);

    let updatedBooking = {
      flightBooking with
      stripeSessionId = sessionId;
      paymentStatus = paymentStatus;
    };
    bookings.add(bookingId, updatedBooking);
    updatedBooking;
  };

  // ========== USER PROFILE & BOOKING HISTORY ==========

  public query ({ caller }) func getCallerBookingHistory() : async [Booking] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access booking history");
    };

    switch (userProfiles.get(caller)) {
      case (null) { Runtime.trap("User profile does not exist") };
      case (?profile) { profile.bookingHistory };
    };
  };

  public query ({ caller }) func getCallerBookings() : async [Booking] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access bookings");
    };

    let userBookings = List.empty<Booking>();
    for ((_, booking) in bookings.entries()) {
      if (booking.user == caller) {
        userBookings.add(booking);
      };
    };
    userBookings.toArray();
  };

  public query ({ caller }) func transform(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };

  public query ({ caller }) func getAllFlights() : async [Flight] {
    flights.values().toArray().sort();
  };

  public query ({ caller }) func getFlightsByOrigin(origin : Text) : async [Flight] {
    let originFlights = List.empty<Flight>();
    for ((_, flight) in flights.entries()) {
      if (flight.origin == origin) {
        originFlights.add(flight);
      };
    };
    originFlights.toArray();
  };

  public query ({ caller }) func getAdministrativeBookings() : async [Booking] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can access administrative bookings");
    };
    bookings.values().toArray().sort();
  };

  public shared ({ caller }) func addFlight(flight : Flight) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can add flights");
    };
    flights.add(flight.flightNumber, flight);
  };

  public shared ({ caller }) func updateFlight(flight : Flight) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can update flights");
    };
    flights.add(flight.flightNumber, flight);
  };

  public shared ({ caller }) func deleteFlight(flightNumber : Text) : async Bool {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can delete flights");
    };
    let existed = flights.containsKey(flightNumber);
    flights.remove(flightNumber);
    existed;
  };

  public shared ({ caller }) func updateBookingStatus(bookingId : Nat, status : BookingStatus) : async Booking {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can update booking status");
    };

    let booking = switch (bookings.get(bookingId)) {
      case (null) { Runtime.trap("Booking does not exist") };
      case (?b) { b };
    };

    // Verify the caller owns this booking or is an admin
    if (booking.user != caller and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only update your own bookings");
    };

    let updatedBooking = { booking with status };
    bookings.add(bookingId, updatedBooking);
    updatedBooking;
  };

  public query ({ caller }) func getBooking(bookingId : Nat) : async Booking {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view bookings");
    };

    let booking = switch (bookings.get(bookingId)) {
      case (null) { Runtime.trap("Booking does not exist") };
      case (?booking) { booking };
    };

    // Verify the caller owns this booking or is an admin
    if (booking.user != caller and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own bookings");
    };

    booking;
  };
};
