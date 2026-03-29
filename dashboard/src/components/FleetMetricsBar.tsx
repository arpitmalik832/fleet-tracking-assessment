import type { FleetSnapshot } from "../lib/simulationEngine";
import { fleetMetrics } from "../lib/simulationEngine";

type Props = {
  snapshot: FleetSnapshot;
};

export function FleetMetricsBar({ snapshot }: Props) {
  const m = fleetMetrics(snapshot);

  const items = [
    { label: "Active", value: m.active, tone: "accent" as const },
    { label: "Completed", value: m.completed, tone: "ok" as const },
    { label: "Cancelled", value: m.cancelled, tone: "warn" as const },
    { label: "≥50% progress (active)", value: m.activeGe50Pct, tone: "muted" as const },
    { label: "≥80% progress (active)", value: m.activeGe80Pct, tone: "muted" as const },
    {
      label: "Fleet avg speed",
      value: m.avgSpeedKmh != null ? `${m.avgSpeedKmh.toFixed(0)} km/h` : "—",
      tone: "muted" as const,
    },
    { label: "Overspeed pings", value: m.overspeedTotal, tone: "warn" as const },
    { label: "Signal lost events", value: m.signalLostTotal, tone: "warn" as const },
    { label: "Events processed", value: snapshot.eventsProcessed.toLocaleString(), tone: "muted" as const },
  ];

  return (
    <div className="metrics-bar">
      {items.map((it) => (
        <div key={it.label} className={`metric metric--${it.tone}`}>
          <span className="metric__value">{it.value}</span>
          <span className="metric__label">{it.label}</span>
        </div>
      ))}
    </div>
  );
}
