import { validateRange } from "./wantok-platform.js";

export const TRANSPORT_METRICS = Object.freeze([
  ["total_operators", "Total registered operators"],
  ["pending_operators", "Pending approvals"],
  ["approved_operators", "Approved operators"],
  ["active_trips", "Active trips (known final arrival)"],
  ["upcoming_trips", "Upcoming trips"],
  ["total_bookings", "Total bookings (all statuses)"],
  ["seats_reserved", "Seats reserved (confirmed passengers)"],
  ["available_seats", "Available through-seats (future segments)"],
  ["completed_trips", "Completed trips"],
  ["cancelled_trips", "Cancelled trips"]
]);
export const OPERATOR_STATUSES = Object.freeze(["pending", "approved", "rejected"]);
export const TRIP_STATUSES = Object.freeze(["published", "completed", "cancelled"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(value, maximum = 1000) {
  if (typeof value !== "string" || value.length > maximum) throw new Error("Invalid transport text.");
  return value;
}
function count(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid transport count.");
  return value;
}
function uuid(value) {
  if (typeof value !== "string" || !uuidPattern.test(value)) throw new Error("Invalid transport ID.");
  return value;
}
function timestamp(value) {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT/.test(value) ||
      !Number.isFinite(Date.parse(value))) throw new Error("Invalid transport timestamp.");
  return value;
}
function nullable(value, validate) { return value === null ? null : validate(value); }
function list(value, validate, max = 500) {
  if (!Array.isArray(value) || value.length > max) throw new Error("Invalid transport list.");
  return value.map(validate);
}
function status(value, allowed) {
  if (!allowed.includes(value)) throw new Error("Unsupported transport status.");
  return value;
}

export function transportInput(input) {
  const action = input.action;
  const allowed = action === "transport_snapshot"
    ? ["action", "date_range", "operators", "trips"]
    : ["action", "kind", "target_id", "expected_status", "expected_updated_at", "status", "reason"];
  if (!["transport_snapshot", "transport_decide"].includes(action) ||
      Object.keys(input).some(key => !allowed.includes(key))) throw new Error("Invalid transport request.");
  if (action === "transport_snapshot") {
    const filter = (value = {}, statuses) => {
      if (!value || typeof value !== "object" || Array.isArray(value) ||
          Object.keys(value).some(key => !["search", "status", "page"].includes(key))) {
        throw new Error("Invalid transport filter.");
      }
      const page = count(value.page ?? 0);
      if (page > 10000) throw new Error("Transport page limit reached.");
      return { search: text(value.search ?? "", 100).trim(), status: status(value.status ?? "", ["", ...statuses]), page };
    };
    return {
      range: input.date_range ? validateRange(input.date_range) : null,
      operators: filter(input.operators, OPERATOR_STATUSES), trips: filter(input.trips, TRIP_STATUSES)
    };
  }
  const kind = status(input.kind, ["operator", "trip"]);
  const statuses = kind === "operator" ? OPERATOR_STATUSES : TRIP_STATUSES;
  const reason = text(input.reason, 500).trim();
  if (!reason) throw new Error("A decision reason is required.");
  const next = status(input.status, kind === "operator" ? ["approved", "rejected"] : ["completed", "cancelled"]);
  const previous = status(input.expected_status, statuses);
  if (previous === next || (kind === "trip" && previous !== "published")) throw new Error("Invalid transition.");
  return {
    kind, target_id: uuid(input.target_id), expected_status: previous,
    expected_updated_at: timestamp(input.expected_updated_at), status: next, reason
  };
}

export function validateTransport(input) {
  if (input?.version !== 2 || input.status !== "available") throw new Error("Unexpected transport response.");
  const period = validateRange(input.period);
  const metrics = Object.fromEntries(TRANSPORT_METRICS.map(([key]) => [key, count(input.metrics?.[key])]));
  if (metrics.pending_operators + metrics.approved_operators > metrics.total_operators) {
    throw new Error("Inconsistent operator counts.");
  }
  const daily = list(input.daily, point => ({
    date: text(point.date, 10), bookings: count(point.bookings),
    registrations: count(point.registrations), cancellations: count(point.cancellations)
  }), 366);
  const days = (Date.parse(period.end) - Date.parse(period.start)) / 86400000 + 1;
  if (daily.length !== days || daily.some((point, index) =>
    point.date !== new Date(Date.parse(period.start) + index * 86400000).toISOString().slice(0, 10))) {
    throw new Error("Invalid transport series dates.");
  }
  const vehicle = row => ({
    vehicle_type: text(row.vehicle_type, 50), registration_number: text(row.registration_number, 30)
  });
  const page = (value, validate) => {
    const page = count(value?.page);
    const total = count(value?.total);
    const rows = list(value?.rows, validate, 25);
    if (page > 10000 || rows.length !== Math.max(0, Math.min(25, total - page * 25))) {
      throw new Error("Invalid transport pagination.");
    }
    return { page, total, rows };
  };
  const operators = page(input.operators, row => ({
    id: uuid(row.id), business_name: text(row.business_name, 100), display_name: text(row.display_name),
    contact_phone: text(row.contact_phone, 25), province: text(row.province, 80),
    operating_area: text(row.operating_area, 150), status: status(row.status, OPERATOR_STATUSES),
    review_note: nullable(row.review_note, value => text(value, 500)),
    reviewed_at: nullable(row.reviewed_at, timestamp), created_at: timestamp(row.created_at),
    updated_at: timestamp(row.updated_at),
    vehicles: list(row.vehicles, v => ({ ...vehicle(v), passenger_capacity: count(v.passenger_capacity) })),
    routes: list(row.routes, r => ({ name: text(r.name), stops: list(r.stops, s => text(s, 100)) }))
  }));
  const trips = page(input.trips, row => {
    const capacity = count(row.capacity);
    const remaining = nullable(row.remaining_seats, count);
    const stops = list(row.stops, s => ({
      position: count(s.position), location: text(s.location, 100),
      arrival_at: nullable(s.arrival_at, timestamp), departure_at: nullable(s.departure_at, timestamp)
    }), 30);
    const segments = list(row.segments, s => ({
      position: count(s.position), reserved: count(s.reserved), remaining: count(s.remaining)
    }), 29);
    if (capacity > 100 || (remaining !== null && remaining > capacity) ||
        stops.some((s, index) => index > 0 && s.position <= stops[index - 1].position) ||
        segments.length !== Math.max(0, stops.length - 1) ||
        segments.some((s, index) => s.reserved + s.remaining !== capacity ||
          s.position !== stops[index]?.position) ||
        (segments.length ? remaining !== Math.min(...segments.map(s => s.remaining)) : remaining !== null)) {
      throw new Error("Invalid segment capacity.");
    }
    return {
      id: uuid(row.id), operator_name: text(row.operator_name, 100),
      departure: text(row.departure, 100), destination: text(row.destination, 100),
      province: text(row.province, 80), departure_at: timestamp(row.departure_at),
      departure_timezone: status(row.departure_timezone, ["Pacific/Port_Moresby", "Pacific/Bougainville"]),
      status: status(row.status, TRIP_STATUSES), updated_at: timestamp(row.updated_at),
      capacity, vehicle: nullable(row.vehicle, vehicle), bookings: count(row.bookings),
      seats_reserved: count(row.seats_reserved), remaining_seats: remaining, stops, segments
    };
  });
  const buckets = (rows, routes = false) => list(rows, row => ({
    label: text(row.label, 250), count: count(row.count), ...(routes ? { bookings: count(row.bookings) } : {})
  }), 20);
  const occupancy = { reserved: count(input.occupancy?.reserved), capacity: count(input.occupancy?.capacity) };
  if (occupancy.reserved > occupancy.capacity) throw new Error("Invalid seat occupancy.");
  return {
    version: 2, status: "available", generated_at: timestamp(input.generated_at), period, metrics, daily,
    operators, trips, routes: buckets(input.routes, true), origins: buckets(input.origins),
    destinations: buckets(input.destinations), by_operator: buckets(input.by_operator),
    occupancy, outcomes: { completed: count(input.outcomes?.completed), cancelled: count(input.outcomes?.cancelled) },
    audit: list(input.audit, row => ({
      id: uuid(row.id), actor_id: uuid(row.actor_id), target_id: uuid(row.target_id),
      target_kind: status(row.target_kind, ["operator", "trip"]),
      old_status: text(row.old_status, 20), new_status: text(row.new_status, 20),
      reason: text(row.reason, 500), created_at: timestamp(row.created_at)
    }), 50)
  };
}
