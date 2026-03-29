import type { FleetSnapshot } from "../lib/simulationEngine";

type Props = {
  snapshot: FleetSnapshot;
};

export function EventFeed({ snapshot }: Props) {
  return (
    <div className="event-feed">
      <h3 className="panel-title">Recent events</h3>
      <ul className="event-feed__list">
        {snapshot.log.length === 0 && (
          <li className="event-feed__empty">Play the simulation to see alerts and milestones.</li>
        )}
        {snapshot.log.map((e, i) => (
          <li key={`${e.time}-${e.type}-${i}`} className="event-feed__item">
            <span className="event-feed__type">{e.type.replace(/_/g, " ")}</span>
            <span className="event-feed__summary">{e.summary}</span>
            <time className="event-feed__time">
              {new Date(e.time).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </time>
          </li>
        ))}
      </ul>
    </div>
  );
}
