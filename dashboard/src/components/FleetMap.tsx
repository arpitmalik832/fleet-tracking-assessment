import { Fragment, useMemo } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer } from "react-leaflet";
import type { FleetSnapshot, TripRuntime } from "../lib/simulationEngine";

const PALETTE = ["#3d8bfd", "#34c759", "#ff9f0a", "#ff453a", "#bf5af2"];

function tripColor(trips: TripRuntime[], trip: TripRuntime) {
  const idx = trips.findIndex((x) => x.tripId === trip.tripId);
  return PALETTE[Math.max(0, idx) % PALETTE.length];
}

/** Decimated trail plus current fix so the line always meets the vehicle marker. */
function linePositions(trip: TripRuntime): [number, number][] {
  if (trip.lastLat == null || trip.lastLng == null) return [];
  const cur: [number, number] = [trip.lastLat, trip.lastLng];
  const base = trip.trail.map(([la, lo]) => [la, lo] as [number, number]);
  if (base.length === 0) return [cur];
  const last = base[base.length - 1];
  const same =
    Math.abs(last[0] - cur[0]) < 1e-7 && Math.abs(last[1] - cur[1]) < 1e-7;
  if (same) return base;
  return [...base, cur];
}

type Props = {
  snapshot: FleetSnapshot;
  selectedTripId: string | null;
};

export function FleetMap({ snapshot, selectedTripId }: Props) {
  const trips = useMemo(() => Object.values(snapshot.trips), [snapshot.trips]);

  const center = useMemo(() => {
    const withLoc = trips.filter((t) => t.lastLat != null && t.lastLng != null);
    if (withLoc.length === 0) return [39.8, -98.5] as [number, number];
    const lat = withLoc.reduce((a, t) => a + (t.lastLat as number), 0) / withLoc.length;
    const lng = withLoc.reduce((a, t) => a + (t.lastLng as number), 0) / withLoc.length;
    return [lat, lng] as [number, number];
  }, [trips]);

  return (
    <MapContainer
      center={center}
      zoom={5}
      style={{ height: "100%", width: "100%", background: "#0c1017" }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {trips.map((trip) => {
        if (trip.lastLat == null || trip.lastLng == null) return null;
        const color = tripColor(trips, trip);
        const key = trip.tripId;
        const isSel = selectedTripId === trip.tripId;
        const positions = linePositions(trip);
        return (
          <Fragment key={key}>
            {positions.length >= 2 && (
              <Polyline
                positions={positions}
                pathOptions={{
                  color,
                  weight: isSel ? 5 : 3,
                  opacity: isSel ? 0.95 : 0.72,
                }}
              />
            )}
            <CircleMarker
              center={[trip.lastLat, trip.lastLng]}
              radius={isSel ? 12 : 8}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.9,
                weight: 2,
              }}
            >
              <Popup>
                <strong>{trip.label}</strong>
                <br />
                {trip.vehicleId}
                <br />
                {trip.phase} · {trip.distanceKm.toFixed(1)} km
                {trip.speedKmh != null && (
                  <>
                    <br />
                    {trip.speedKmh.toFixed(0)} km/h
                  </>
                )}
              </Popup>
            </CircleMarker>
          </Fragment>
        );
      })}
    </MapContainer>
  );
}
