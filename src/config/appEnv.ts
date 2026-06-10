/**
 * Frontend data-mode model.
 *
 * - "demo": development / showcase. Local fallbacks silently stand in for
 *   missing services and demo content renders without warnings.
 * - "live": real deployment. Demo/hardcoded content is labelled, and any
 *   backend outage or local-fallback data raises a visible service banner
 *   instead of silently pretending everything works.
 *
 * Explicit VITE_DATA_MODE wins; otherwise production builds default to
 * "live" and dev servers to "demo".
 */
export type DataMode = "demo" | "live";

const configured = (import.meta.env.VITE_DATA_MODE ?? "").trim().toLowerCase();

export const DATA_MODE: DataMode = configured === "live" || configured === "demo"
  ? (configured as DataMode)
  : (import.meta.env.PROD ? "live" : "demo");

export const IS_LIVE = DATA_MODE === "live";
