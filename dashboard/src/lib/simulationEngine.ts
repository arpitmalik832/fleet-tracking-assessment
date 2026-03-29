import type { FleetEvent } from "../types/events";

export type TripPhase = "pending" | "active" | "completed" | "cancelled";

const LOG_CAP = 100;
/** Hard safety cap after decimation (cross-country can still yield thousands of vertices). */
const TRAIL_MAX_POINTS = 8000;

const EARTH_RADIUS_KM = 6371;

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rLat = ((bLat - aLat) * Math.PI) / 180;
  const rLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(rLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(rLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Longer planned routes use coarser sampling so the full path fits in memory and renders smoothly. */
function minTrailSegmentKm(trip: TripRuntime): number {
  const p = trip.plannedKm ?? 80;
  if (p > 400) return 2;
  if (p > 120) return 1;
  return 0.35;
}

export type TripRuntime = {
  tripId: string;
  vehicleId: string;
  label: string;
  phase: TripPhase;
  plannedKm: number | null;
  estHours: number | null;
  distanceKm: number;
  lastLat: number | null;
  lastLng: number | null;
  speedKmh: number | null;
  headingDeg: number | null;
  battery: number | null;
  signalQuality: string | null;
  overspeedCount: number;
  signalLostCount: number;
  harshBrakeCount: number;
  trail: [number, number][];
  cancellationReason?: string;
};

export type LogEntry = {
  time: number;
  tripId: string;
  type: string;
  summary: string;
};

export type FleetSnapshot = {
  trips: Record<string, TripRuntime>;
  log: LogEntry[];
  eventsProcessed: number;
};

export type TripSource = {
  label: string;
  events: FleetEvent[];
};

function ts(e: FleetEvent): number {
  return new Date(e.timestamp).getTime();
}

function emptyTrip(tripId: string, label: string): TripRuntime {
  return {
    tripId,
    vehicleId: "",
    label,
    phase: "pending",
    plannedKm: null,
    estHours: null,
    distanceKm: 0,
    lastLat: null,
    lastLng: null,
    speedKmh: null,
    headingDeg: null,
    battery: null,
    signalQuality: null,
    overspeedCount: 0,
    signalLostCount: 0,
    harshBrakeCount: 0,
    trail: [],
  };
}

function pushTrail(trip: TripRuntime, lat: number, lng: number, force = false) {
  const last = trip.trail[trip.trail.length - 1];
  if (last && last[0] === lat && last[1] === lng) return;

  if (!last) {
    trip.trail.push([lat, lng]);
    return;
  }

  const minKm = minTrailSegmentKm(trip);
  const d = haversineKm(last[0], last[1], lat, lng);
  if (force || d >= minKm) {
    trip.trail.push([lat, lng]);
  }

  if (trip.trail.length > TRAIL_MAX_POINTS) {
    const step = Math.ceil(trip.trail.length / (TRAIL_MAX_POINTS * 0.85));
    const kept: [number, number][] = [];
    for (let i = 0; i < trip.trail.length; i += step) {
      kept.push(trip.trail[i]);
    }
    const end = trip.trail[trip.trail.length - 1];
    const prev = kept[kept.length - 1];
    if (!prev || prev[0] !== end[0] || prev[1] !== end[1]) kept.push(end);
    trip.trail = kept;
  }
}

function pushLog(log: LogEntry[], entry: LogEntry) {
  log.unshift(entry);
  if (log.length > LOG_CAP) log.length = LOG_CAP;
}

function applyEvent(trip: TripRuntime, e: FleetEvent, log: LogEntry[], label: string) {
  const t = ts(e);
  const tripId = e.trip_id;

  switch (e.event_type) {
    case "trip_started":
      trip.vehicleId = e.vehicle_id;
      trip.label = label;
      trip.phase = "active";
      trip.plannedKm = e.planned_distance_km ?? null;
      trip.estHours = e.estimated_duration_hours ?? null;
      if (e.location) {
        trip.lastLat = e.location.lat;
        trip.lastLng = e.location.lng;
        pushTrail(trip, e.location.lat, e.location.lng);
      }
      pushLog(log, {
        time: t,
        tripId,
        type: e.event_type,
        summary: `Started · planned ${e.planned_distance_km ?? "?"} km`,
      });
      break;

    case "location_ping":
      if (trip.phase === "pending") trip.phase = "active";
      if (!trip.vehicleId) trip.vehicleId = e.vehicle_id;
      if (e.location) {
        trip.lastLat = e.location.lat;
        trip.lastLng = e.location.lng;
        pushTrail(trip, e.location.lat, e.location.lng);
      }
      if (e.movement) {
        trip.speedKmh = e.movement.speed_kmh ?? trip.speedKmh;
        trip.headingDeg = e.movement.heading_degrees ?? trip.headingDeg;
      }
      if (typeof e.distance_travelled_km === "number") {
        trip.distanceKm = Math.max(trip.distanceKm, e.distance_travelled_km);
      }
      trip.signalQuality = e.signal_quality ?? trip.signalQuality;
      trip.battery = e.device?.battery_level ?? trip.battery;
      if (e.overspeed) trip.overspeedCount += 1;
      break;

    case "trip_completed":
      trip.phase = "completed";
      if (e.location) {
        trip.lastLat = e.location.lat;
        trip.lastLng = e.location.lng;
        pushTrail(trip, e.location.lat, e.location.lng, true);
      }
      if (typeof e.total_distance_km === "number") trip.distanceKm = e.total_distance_km;
      pushLog(log, {
        time: t,
        tripId,
        type: e.event_type,
        summary: `Completed · ${e.total_distance_km ?? trip.distanceKm} km`,
      });
      break;

    case "trip_cancelled":
      trip.phase = "cancelled";
      trip.cancellationReason = String(e.cancellation_reason ?? "unknown");
      if (typeof e.distance_completed_km === "number") trip.distanceKm = e.distance_completed_km;
      if (e.location) {
        trip.lastLat = e.location.lat;
        trip.lastLng = e.location.lng;
        pushTrail(trip, e.location.lat, e.location.lng, true);
      }
      pushLog(log, {
        time: t,
        tripId,
        type: e.event_type,
        summary: `Cancelled · ${trip.cancellationReason}`,
      });
      break;

    case "signal_lost":
      trip.signalLostCount += 1;
      trip.signalQuality = "lost";
      pushLog(log, { time: t, tripId, type: e.event_type, summary: "GPS signal lost" });
      break;

    case "harsh_braking":
    case "harsh_brake":
      trip.harshBrakeCount += 1;
      pushLog(log, { time: t, tripId, type: e.event_type, summary: "Harsh braking" });
      break;

    case "fuel_low":
    case "low_fuel":
      pushLog(log, { time: t, tripId, type: e.event_type, summary: "Low fuel warning" });
      break;

    default:
      if (e.location?.lat != null && e.location?.lng != null) {
        trip.lastLat = e.location.lat;
        trip.lastLng = e.location.lng;
        pushTrail(trip, e.location.lat, e.location.lng);
      }
      if (
        e.event_type.includes("alert") ||
        e.event_type.includes("warning") ||
        e.event_type.includes("error")
      ) {
        pushLog(log, {
          time: t,
          tripId,
          type: e.event_type,
          summary: e.event_type.replace(/_/g, " "),
        });
      }
      break;
  }
}

function cloneSnapshot(
  trips: Record<string, TripRuntime>,
  log: LogEntry[],
  processed: number
): FleetSnapshot {
  const t: Record<string, TripRuntime> = {};
  for (const k of Object.keys(trips)) {
    const x = trips[k];
    t[k] = {
      ...x,
      trail: x.trail.map((p) => [p[0], p[1]] as [number, number]),
    };
  }
  return { trips: t, log: [...log], eventsProcessed: processed };
}

export class SimulationEngine {
  private sources: TripSource[];
  private indices: number[] = [];
  private trips: Record<string, TripRuntime> = {};
  private log: LogEntry[] = [];
  private processed = 0;
  private lastSimTime = -Infinity;
  readonly minTs: number;
  readonly maxTs: number;

  constructor(sources: TripSource[]) {
    this.sources = sources;
    let minT = Infinity;
    let maxT = -Infinity;
    for (const s of sources) {
      if (s.events.length === 0) continue;
      minT = Math.min(minT, ts(s.events[0]));
      maxT = Math.max(maxT, ts(s.events[s.events.length - 1]));
    }
    if (!Number.isFinite(minT)) {
      minT = 0;
      maxT = 1;
    }
    this.minTs = minT;
    this.maxTs = maxT;
    this.reset();
  }

  reset() {
    this.indices = this.sources.map(() => 0);
    this.trips = {};
    this.log = [];
    this.processed = 0;
    this.lastSimTime = -Infinity;
    for (let i = 0; i < this.sources.length; i++) {
      const started = this.sources[i].events.find((e) => e.event_type === "trip_started");
      const tid = started?.trip_id;
      if (tid) {
        this.trips[tid] = emptyTrip(tid, this.sources[i].label);
      }
    }
  }

  /** Advance simulation clock to targetTime (ms). Handles seeks backward. */
  advanceTo(targetTime: number): FleetSnapshot {
    if (targetTime < this.lastSimTime) {
      this.reset();
    }
    this.lastSimTime = targetTime;

    const n = this.sources.length;
    for (;;) {
      let bestI = -1;
      let bestT = Infinity;
      for (let i = 0; i < n; i++) {
        const arr = this.sources[i].events;
        const j = this.indices[i];
        if (j >= arr.length) continue;
        const t = ts(arr[j]);
        if (t <= targetTime && t < bestT) {
          bestT = t;
          bestI = i;
        }
      }
      if (bestI < 0) break;

      const e = this.sources[bestI].events[this.indices[bestI]];
      this.indices[bestI] += 1;
      this.processed += 1;

      const tid = e.trip_id;
      if (!this.trips[tid]) {
        this.trips[tid] = emptyTrip(tid, this.sources[bestI].label);
      }
      applyEvent(this.trips[tid], e, this.log, this.sources[bestI].label);
    }

    return cloneSnapshot(this.trips, this.log, this.processed);
  }
}

export function fleetMetrics(snapshot: FleetSnapshot) {
  const list = Object.values(snapshot.trips);
  const active = list.filter((x) => x.phase === "active").length;
  const completed = list.filter((x) => x.phase === "completed").length;
  const cancelled = list.filter((x) => x.phase === "cancelled").length;
  const pending = list.filter((x) => x.phase === "pending").length;

  const progressOf = (t: TripRuntime) => {
    if (!t.plannedKm || t.plannedKm <= 0) return 0;
    return Math.min(1, t.distanceKm / t.plannedKm);
  };

  const inMotion = list.filter((t) => t.phase === "active");
  const ge50 = inMotion.filter((t) => progressOf(t) >= 0.5).length;
  const ge80 = inMotion.filter((t) => progressOf(t) >= 0.8).length;

  const overspeedTotal = list.reduce((a, t) => a + t.overspeedCount, 0);
  const signalLostTotal = list.reduce((a, t) => a + t.signalLostCount, 0);

  const speeds = inMotion
    .map((t) => t.speedKmh)
    .filter((s): s is number => s != null && !Number.isNaN(s));
  const avgSpeed =
    speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : null;

  return {
    active,
    completed,
    cancelled,
    pending,
    totalTrips: list.length,
    activeGe50Pct: ge50,
    activeGe80Pct: ge80,
    overspeedTotal,
    signalLostTotal,
    avgSpeedKmh: avgSpeed,
  };
}
