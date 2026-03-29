import { TRIP_FILES } from "../tripConfig";
import type { FleetEvent } from "../types/events";
import type { TripSource } from "./simulationEngine";

const base = import.meta.env.BASE_URL;

export async function loadAllTrips(): Promise<TripSource[]> {
  const out: TripSource[] = [];
  for (const cfg of TRIP_FILES) {
    const url = `${base}data/${cfg.file}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to load ${cfg.file}: ${res.status}`);
    }
    const events = (await res.json()) as FleetEvent[];
    out.push({ label: cfg.label, events });
  }
  return out;
}
