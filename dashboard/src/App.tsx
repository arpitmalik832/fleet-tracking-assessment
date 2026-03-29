import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EventFeed } from "./components/EventFeed";
import { FleetMap } from "./components/FleetMap";
import { FleetMetricsBar } from "./components/FleetMetricsBar";
import { TripCards } from "./components/TripCards";
import { loadAllTrips } from "./lib/loadTrips";
import { SimulationEngine, type FleetSnapshot } from "./lib/simulationEngine";

/** Wall-clock duration (at 1×) to play the full merged timeline */
const BASE_PLAYBACK_MS = 10 * 60 * 1000;

function formatClock(ms: number) {
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function App() {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const engineRef = useRef<SimulationEngine | null>(null);
  const [simTime, setSimTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadAllTrips()
      .then((sources) => {
        if (cancelled) return;
        engineRef.current = new SimulationEngine(sources);
        setSimTime(engineRef.current.minTs);
        setLoadError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : "Failed to load trip data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const engine = engineRef.current;
  const span = engine ? engine.maxTs - engine.minTs : 1;
  const simMsPerRealMs = useMemo(
    () => (span / BASE_PLAYBACK_MS) * speed,
    [span, speed]
  );

  useEffect(() => {
    if (!playing || !engine) return;
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setSimTime((prev) => {
        const next = prev + dt * simMsPerRealMs;
        if (next >= engine.maxTs) {
          return engine.maxTs;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, engine, simMsPerRealMs]);

  useEffect(() => {
    if (engine && simTime >= engine.maxTs) setPlaying(false);
  }, [simTime, engine]);

  const snapshot: FleetSnapshot | null = useMemo(() => {
    if (!engineRef.current) return null;
    return engineRef.current.advanceTo(simTime);
  }, [simTime]);

  const progress = engine ? (simTime - engine.minTs) / span : 0;

  const onScrub = useCallback(
    (pct: number) => {
      if (!engineRef.current) return;
      const t = engineRef.current.minTs + pct * span;
      setSimTime(t);
    },
    [span]
  );

  if (loading) {
    return (
      <div className="app app--center">
        <p className="muted">Loading fleet data…</p>
      </div>
    );
  }

  if (loadError || !snapshot || !engine) {
    return (
      <div className="app app--center">
        <p className="error">{loadError ?? "No data"}</p>
        <p className="muted small">
          Run <code>npm run copy-data</code> from the <code>dashboard</code> folder, then refresh.
        </p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header__brand">
          <h1>Fleet tracking</h1>
          <p className="muted header__sub">Live playback from merged trip timelines</p>
        </div>

        <div className="playback">
          <div className="playback__row">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setPlaying((p) => !p)}
              aria-pressed={playing}
            >
              {playing ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setPlaying(false);
                setSimTime(engine.minTs);
              }}
            >
              Reset
            </button>
            <span className="playback__speed-label">Speed</span>
            {([1, 5, 10] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={`btn ${speed === s ? "btn--active" : ""}`}
                onClick={() => setSpeed(s)}
              >
                {s}×
              </button>
            ))}
          </div>
          <div className="playback__time muted small">
            Simulated time: <strong>{formatClock(simTime)}</strong>
            <span className="playback__span">
              ({(progress * 100).toFixed(1)}% of timeline)
            </span>
          </div>
          <label className="scrub-label">
            <span className="sr-only">Scrub simulation time</span>
            <input
              type="range"
              min={0}
              max={1000}
              value={Math.round(progress * 1000)}
              onChange={(e) => onScrub(Number(e.target.value) / 1000)}
            />
          </label>
        </div>
      </header>

      <FleetMetricsBar snapshot={snapshot} />

      <div className="layout">
        <section className="map-wrap" aria-label="Map">
          <FleetMap snapshot={snapshot} selectedTripId={selectedTripId} />
        </section>
        <aside className="sidebar">
          <h2 className="panel-title">Trips</h2>
          <TripCards
            snapshot={snapshot}
            selectedTripId={selectedTripId}
            onSelect={setSelectedTripId}
          />
          <EventFeed snapshot={snapshot} />
        </aside>
      </div>
    </div>
  );
}
