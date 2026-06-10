import type { MapPoint } from "../types";

/** Planar approximation in meters — fine at city scale. */
export function flatMeters(a: MapPoint, b: MapPoint): number {
  const lngScale = Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
  const dx = (a.lng - b.lng) * lngScale;
  const dy = a.lat - b.lat;
  return Math.sqrt(dx * dx + dy * dy) * 111_320;
}

export function pathMeters(points: MapPoint[]): number {
  return points.slice(1).reduce((total, point, index) => total + flatMeters(points[index], point), 0);
}

/**
 * Order stops as an open tour (free start and end): nearest-neighbor from
 * every possible start, each improved with 2-opt, keeping the shortest.
 * Exact enough for demo-scale stop counts (n <= 12).
 */
export function orderOpenTour(stops: MapPoint[]): MapPoint[] {
  if (stops.length <= 2) return stops;
  let best = stops;
  let bestLength = Infinity;
  for (let start = 0; start < stops.length; start += 1) {
    const candidate = twoOptImprove(nearestNeighborFrom(stops, start));
    const length = pathMeters(candidate);
    if (length < bestLength) {
      bestLength = length;
      best = candidate;
    }
  }
  return best;
}

/** Order arbitrary items (e.g. POIs) as an open tour by their coordinates. */
export function orderOpenTourBy<T>(items: T[], toPoint: (item: T) => MapPoint): T[] {
  if (items.length <= 2) return items;
  const indexed = items.map((item, index) => {
    const point = toPoint(item);
    return { lng: point.lng, lat: point.lat, name: String(index) };
  });
  return orderOpenTour(indexed).map((point) => items[Number(point.name)]);
}

function nearestNeighborFrom(stops: MapPoint[], startIndex: number): MapPoint[] {
  const remaining = stops.slice();
  const ordered = remaining.splice(startIndex, 1);
  while (remaining.length) {
    const last = ordered[ordered.length - 1];
    let bestIndex = 0;
    let bestDistance = Infinity;
    remaining.forEach((stop, index) => {
      const distance = flatMeters(last, stop);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    ordered.push(remaining.splice(bestIndex, 1)[0]);
  }
  return ordered;
}

function twoOptImprove(path: MapPoint[]): MapPoint[] {
  const result = path.slice();
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < result.length - 1; i += 1) {
      for (let j = i + 1; j < result.length - 1; j += 1) {
        const current = flatMeters(result[i - 1], result[i]) + flatMeters(result[j], result[j + 1]);
        const swapped = flatMeters(result[i - 1], result[j]) + flatMeters(result[i], result[j + 1]);
        if (swapped < current) {
          for (let lo = i, hi = j; lo < hi; lo += 1, hi -= 1) {
            const temp = result[lo];
            result[lo] = result[hi];
            result[hi] = temp;
          }
          improved = true;
        }
      }
    }
  }
  return result;
}
