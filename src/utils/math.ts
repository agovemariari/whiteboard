/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BoundingBox, Point, Stroke, ViewTransform } from '../types/whiteboard';

export function screenToWorld(
  screenX: number,
  screenY: number,
  view: ViewTransform
): { x: number; y: number } {
  return {
    x: (screenX - view.panX) / view.zoom,
    y: (screenY - view.panY) / view.zoom,
  };
}

export function worldToScreen(
  worldX: number,
  worldY: number,
  view: ViewTransform
): { x: number; y: number } {
  return {
    x: worldX * view.zoom + view.panX,
    y: worldY * view.zoom + view.panY,
  };
}

export function calculateStrokeBounds(points: Point[], extraPadding = 10): BoundingBox {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;

  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  return {
    minX: minX - extraPadding,
    minY: minY - extraPadding,
    maxX: maxX + extraPadding,
    maxY: maxY + extraPadding,
  };
}

export function isBoundsIntersecting(b1: BoundingBox, b2: BoundingBox): boolean {
  return !(
    b1.maxX < b2.minX ||
    b1.minX > b2.maxX ||
    b1.maxY < b2.minY ||
    b1.minY > b2.maxY
  );
}

/**
 * Distance squared from a point (px, py) to a line segment (x1, y1)-(x2, y2)
 */
export function distToSegmentSquared(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    const dpx = px - x1;
    const dpy = py - y1;
    return dpx * dpx + dpy * dpy;
  }

  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  const diffX = px - projX;
  const diffY = py - projY;

  return diffX * diffX + diffY * diffY;
}

/**
 * Checks if line segment AB and line segment CD intersect
 */
function ccw(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): boolean {
  return (cy - ay) * (bx - ax) > (by - ay) * (cx - ax);
}

export function lineSegmentsIntersect(
  a1x: number,
  a1y: number,
  a2x: number,
  a2y: number,
  b1x: number,
  b1y: number,
  b2x: number,
  b2y: number
): boolean {
  return (
    ccw(a1x, a1y, b1x, b1y, b2x, b2y) !== ccw(a2x, a2y, b1x, b1y, b2x, b2y) &&
    ccw(a1x, a1y, a2x, a2y, b1x, b1y) !== ccw(a1x, a1y, a2x, a2y, b2x, b2y)
  );
}

/**
 * Minimum distance squared between two line segments (a1-a2) and (b1-b2)
 */
export function segmentToSegmentDistanceSq(
  a1x: number,
  a1y: number,
  a2x: number,
  a2y: number,
  b1x: number,
  b1y: number,
  b2x: number,
  b2y: number
): number {
  // If they intersect, distance is 0
  if (lineSegmentsIntersect(a1x, a1y, a2x, a2y, b1x, b1y, b2x, b2y)) {
    return 0;
  }

  // Check endpoint distances to segments
  const d1 = distToSegmentSquared(a1x, a1y, b1x, b1y, b2x, b2y);
  const d2 = distToSegmentSquared(a2x, a2y, b1x, b1y, b2x, b2y);
  const d3 = distToSegmentSquared(b1x, b1y, a1x, a1y, a2x, a2y);
  const d4 = distToSegmentSquared(b2x, b2y, a1x, a1y, a2x, a2y);

  return Math.min(d1, d2, d3, d4);
}

/**
 * Tests whether an eraser sweep segment (e1 to e2) hits a stroke.
 * An eraser has an effective hit radius (e.g. 16 world units + stroke half-width).
 */
export function doesEraserSweepHitStroke(
  e1: Point,
  e2: Point,
  stroke: Stroke,
  eraserRadius: number
): boolean {
  const strokeThreshold = eraserRadius + stroke.baseWidth / 2;
  const strokeThresholdSq = strokeThreshold * strokeThreshold;

  // Quick bounding box rejection
  const sweepBounds: BoundingBox = {
    minX: Math.min(e1.x, e2.x) - strokeThreshold,
    minY: Math.min(e1.y, e2.y) - strokeThreshold,
    maxX: Math.max(e1.x, e2.x) + strokeThreshold,
    maxY: Math.max(e1.y, e2.y) + strokeThreshold,
  };

  if (!isBoundsIntersecting(sweepBounds, stroke.bounds)) {
    return false;
  }

  const pts = stroke.points;
  if (pts.length === 0) return false;

  if (pts.length === 1) {
    // Single dot stroke
    const dSq = distToSegmentSquared(pts[0].x, pts[0].y, e1.x, e1.y, e2.x, e2.y);
    return dSq <= strokeThresholdSq;
  }

  // Segment by segment check
  for (let i = 0; i < pts.length - 1; i++) {
    const pA = pts[i];
    const pB = pts[i + 1];

    const dSq = segmentToSegmentDistanceSq(
      e1.x,
      e1.y,
      e2.x,
      e2.y,
      pA.x,
      pA.y,
      pB.x,
      pB.y
    );

    if (dSq <= strokeThresholdSq) {
      return true;
    }
  }

  return false;
}

/**
 * Calculate the overall bounding box enclosing all strokes.
 */
export function calculateContentBounds(strokes: Stroke[]): BoundingBox | null {
  if (strokes.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const stroke of strokes) {
    if (stroke.bounds.minX < minX) minX = stroke.bounds.minX;
    if (stroke.bounds.minY < minY) minY = stroke.bounds.minY;
    if (stroke.bounds.maxX > maxX) maxX = stroke.bounds.maxX;
    if (stroke.bounds.maxY > maxY) maxY = stroke.bounds.maxY;
  }

  if (minX === Infinity) return null;

  return { minX, minY, maxX, maxY };
}
