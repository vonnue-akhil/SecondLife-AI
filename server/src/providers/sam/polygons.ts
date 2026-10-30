// Turns a SAM mask into a few simplified polygons in image pixel coordinates.
import { decodeMaskToSVGPath, type SegmentationMaskRecord } from '@meta-sam/parser';

type Point = [number, number];

const MIN_AREA_FRACTION = 0.0015; // drop fragments smaller than 0.15% of the image
const MAX_POINTS = 200;
const MAX_POLYGONS = 10;

/** Parses "M x yL x y…Z" subpaths (mask-local coords) into point lists. */
function parseSubpaths(d: string): Point[][] {
  return d
    .split('M')
    .filter(Boolean)
    .map((sub) =>
      sub
        .replace(/Z\s*$/, '')
        .split('L')
        .map((pt) => pt.trim().split(/[\s,]+/).map(Number))
        .filter((p): p is Point => p.length === 2 && p.every(Number.isFinite)),
    )
    .filter((points) => points.length >= 3);
}

function area(points: Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i]!;
    const [x2, y2] = points[(i + 1) % points.length]!;
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

function distToSegment([px, py]: Point, [ax, ay]: Point, [bx, by]: Point): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Iterative Douglas-Peucker on an open polyline. */
function douglasPeucker(points: Point[], tolerance: number): Point[] {
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop()!;
    let worst = -1;
    let at = lo;
    for (let i = lo + 1; i < hi; i++) {
      const d = distToSegment(points[i]!, points[lo]!, points[hi]!);
      if (d > worst) [worst, at] = [d, i];
    }
    if (worst > tolerance) {
      keep[at] = 1;
      stack.push([lo, at], [at, hi]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Simplifies a closed ring, raising the tolerance until it fits MAX_POINTS. */
function simplifyRing(ring: Point[], tolerance: number): Point[] {
  let tol = tolerance;
  let out = douglasPeucker([...ring, ring[0]!], tol).slice(0, -1);
  while (out.length > MAX_POINTS && tol < 100) {
    tol *= 1.5;
    out = douglasPeucker([...ring, ring[0]!], tol).slice(0, -1);
  }
  return out;
}

/**
 * Polygons for one mask record, in pixel coordinates of an imageW x imageH image. The raster covers `bounds`
 * and is downscaled, so each mask-local point is scaled up by bounds size / mask size. Holes and fragments
 * come back as extra polygons (the client fills them evenodd).
 */
export function maskToPolygons(record: SegmentationMaskRecord, imageW: number, imageH: number): [number, number][][] {
  const { mask, bounds } = record;
  if (!mask.width || !mask.height) return [];
  const sx = (bounds.right - bounds.left) / mask.width;
  const sy = (bounds.bottom - bounds.top) / mask.height;
  const clamp = (v: number, max: number) => Math.min(max, Math.max(0, v));
  const tolerance = Math.max(1.5, Math.max(imageW, imageH) / 600);
  const minArea = imageW * imageH * MIN_AREA_FRACTION;

  const polygons = parseSubpaths(decodeMaskToSVGPath(mask))
    .map((ring) => ring.map(([x, y]): Point => [clamp(bounds.left + x * sx, imageW), clamp(bounds.top + y * sy, imageH)]))
    .filter((ring) => area(ring) >= minArea)
    .sort((a, b) => area(b) - area(a))
    .slice(0, MAX_POLYGONS)
    .map((ring) => simplifyRing(ring, tolerance))
    .filter((ring) => ring.length >= 3)
    .map((ring) => ring.map(([x, y]): Point => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]));
  return polygons;
}
