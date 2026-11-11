// Synthetic test data only. Never imported by production modules.
module.exports = function transportFixture(period) {
  const id = suffix => `00000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;
  const generated = "2026-11-11T12:00:00+00:00";
  const days = (Date.parse(period.end) - Date.parse(period.start)) / 86400000 + 1;
  return {
    version: 2, status: "available", generated_at: generated, period,
    metrics: {
      total_operators: 1, pending_operators: 1, approved_operators: 0,
      active_trips: 0, upcoming_trips: 1, total_bookings: 2, seats_reserved: 4,
      available_seats: 1, completed_trips: 0, cancelled_trips: 0
    },
    daily: Array.from({ length: days }, (_, i) => ({
      date: new Date(Date.parse(period.start) + i * 86400000).toISOString().slice(0, 10),
      bookings: i === 0 ? 2 : 0, registrations: i === 0 ? 1 : 0, cancellations: 0
    })),
    routes: [{ label: "A town -> C town", count: 1, bookings: 2 }],
    origins: [{ label: "A town", count: 1 }], destinations: [{ label: "C town", count: 1 }],
    by_operator: [{ label: "Test PMV", count: 1 }],
    occupancy: { reserved: 4, capacity: 6 }, outcomes: { completed: 0, cancelled: 0 },
    operators: { page: 0, total: 1, rows: [{
      id: id(1), business_name: "Test PMV", display_name: "Test operator",
      contact_phone: "12345678", province: "Test province", operating_area: "Test area",
      status: "pending", review_note: null, reviewed_at: null,
      created_at: generated, updated_at: generated,
      vehicles: [{ vehicle_type: "Bus", registration_number: "TEST-123", passenger_capacity: 3 }],
      routes: [{ name: "Test route", stops: ["A town", "B town", "C town"] }]
    }] },
    trips: { page: 0, total: 1, rows: [{
      id: id(2), operator_name: "Test PMV", departure: "A town", destination: "C town",
      province: "Test province", departure_at: generated, departure_timezone: "Pacific/Port_Moresby",
      status: "published", updated_at: generated, capacity: 3,
      vehicle: { vehicle_type: "Bus", registration_number: "TEST-123" },
      bookings: 2, seats_reserved: 4, remaining_seats: 1,
      stops: [1, 2, 3].map((position, i) => ({
        position, location: ["A town", "B town", "C town"][i], arrival_at: generated, departure_at: generated
      })),
      segments: [1, 2].map(position => ({ position, reserved: 2, remaining: 1 }))
    }] },
    audit: []
  };
};
