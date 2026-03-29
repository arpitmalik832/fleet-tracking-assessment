import type { FleetSnapshot, TripRuntime } from "../lib/simulationEngine";

const PALETTE = ["#3d8bfd", "#34c759", "#ff9f0a", "#ff453a", "#bf5af2"];

function colorFor(trips: TripRuntime[], trip: TripRuntime) {
  const idx = trips.findIndex((x) => x.tripId === trip.tripId);
  return PALETTE[Math.max(0, idx) % PALETTE.length];
}

function progressPct(t: TripRuntime) {
  if (!t.plannedKm || t.plannedKm <= 0) return null;
  return Math.min(100, (t.distanceKm / t.plannedKm) * 100);
}

function phaseClass(phase: TripRuntime["phase"]) {
  if (phase === "active") return "phase--active";
  if (phase === "completed") return "phase--done";
  if (phase === "cancelled") return "phase--cancelled";
  return "phase--pending";
}

type Props = {
  snapshot: FleetSnapshot;
  selectedTripId: string | null;
  onSelect: (tripId: string | null) => void;
};

export function TripCards({ snapshot, selectedTripId, onSelect }: Props) {
  const trips = Object.values(snapshot.trips);

  return (
    <div className="trip-cards">
      {trips.map((trip) => {
        const pct = progressPct(trip);
        const color = colorFor(trips, trip);
        const sel = selectedTripId === trip.tripId;
        return (
          <button
            key={trip.tripId}
            type="button"
            className={`trip-card ${sel ? "trip-card--selected" : ""}`}
            onClick={() => onSelect(sel ? null : trip.tripId)}
          >
            <div className="trip-card__head">
              <span className="trip-card__dot" style={{ background: color }} aria-hidden />
              <span className="trip-card__title">{trip.label}</span>
              <span className={`trip-card__phase ${phaseClass(trip.phase)}`}>{trip.phase}</span>
            </div>
            <div className="trip-card__meta">
              <span>{trip.vehicleId || "—"}</span>
              {pct != null && (
                <span>
                  {pct.toFixed(0)}% of {trip.plannedKm?.toFixed(0) ?? "?"} km
                </span>
              )}
            </div>
            {pct != null && (
              <div className="trip-card__bar" role="presentation">
                <div className="trip-card__fill" style={{ width: `${pct}%`, background: color }} />
              </div>
            )}
            <div className="trip-card__stats">
              <span>{trip.distanceKm.toFixed(1)} km driven</span>
              {trip.speedKmh != null && <span>{trip.speedKmh.toFixed(0)} km/h</span>}
              {trip.battery != null && <span>Batt {trip.battery.toFixed(0)}%</span>}
              {trip.signalQuality && <span className="trip-card__signal">{trip.signalQuality}</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}
