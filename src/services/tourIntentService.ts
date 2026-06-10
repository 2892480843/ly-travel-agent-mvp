import type { MapPoint } from "../types";

export type TourIntent = {
  source: "assistant" | "itinerary";
  /** Human-readable origin, e.g. the question that produced the plan. */
  label: string;
  stops: MapPoint[];
  /** Multi-day plans: per-day stop groups; `stops` then holds day 1. */
  days?: Array<{ day: string; stops: MapPoint[] }>;
  createdAt: number;
};

const storageKey = "ly.tour.intent";
const TOUR_INTENT_TTL_MS = 2 * 60 * 60 * 1000;

let memoryIntent: TourIntent | undefined;

export function saveTourIntent(intent: Omit<TourIntent, "createdAt">) {
  if (intent.stops.length < 2) return;
  const payload: TourIntent = { ...intent, createdAt: Date.now() };
  memoryIntent = payload;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch {
    // Storage may be unavailable (private mode); memory copy still works.
  }
}

export function readTourIntent(): TourIntent | undefined {
  let intent = memoryIntent;
  if (!intent) {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) intent = JSON.parse(raw) as TourIntent;
    } catch {
      return undefined;
    }
  }
  if (!intent) return undefined;
  const valid = Date.now() - intent.createdAt < TOUR_INTENT_TTL_MS
    && Array.isArray(intent.stops)
    && intent.stops.length >= 2
    && intent.stops.every((stop) => Number.isFinite(stop.lng) && Number.isFinite(stop.lat));
  if (!valid) {
    clearTourIntent();
    return undefined;
  }
  memoryIntent = intent;
  return intent;
}

export function clearTourIntent() {
  memoryIntent = undefined;
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Ignore storage failures.
  }
}
