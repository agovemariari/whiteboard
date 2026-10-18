/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Stroke } from '../types/whiteboard';
import { calculateContentBounds } from './math';

const MAX_EXPORT_DIMENSION = 6000;
const EXPORT_PADDING = 48;

/**
 * Render stroke on 2D context
 */
export function renderStrokeToContext(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  const pts = stroke.points;
  if (pts.length === 0) return;

  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (pts.length === 1) {
    // Single dot
    const p = pts[0];
    const radius = (stroke.baseWidth * (stroke.usePressure ? Math.max(0.3, p.pressure) : 1)) / 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(radius, 1), 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (stroke.usePressure) {
    // Variable width rendering with segments
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const w1 = stroke.baseWidth * Math.max(0.2, p1.pressure);
      const w2 = stroke.baseWidth * Math.max(0.2, p2.pressure);
      const avgW = (w1 + w2) / 2;

      ctx.lineWidth = avgW;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  } else {
    // Fast high-quality quadratic smoothing for constant width
    ctx.lineWidth = stroke.baseWidth;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);

    if (pts.length === 2) {
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.stroke();
      return;
    }

    for (let i = 1; i < pts.length - 1; i++) {
      const pCurrent = pts[i];
      const pNext = pts[i + 1];
      const midX = (pCurrent.x + pNext.x) / 2;
      const midY = (pCurrent.y + pNext.y) / 2;
      ctx.quadraticCurveTo(pCurrent.x, pCurrent.y, midX, midY);
    }

    // Connect to final point
    const last = pts[pts.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }
}

/**
 * Export all content as high-resolution white background PNG
 */
export async function exportStrokesToPNG(
  strokes: Stroke[],
  filename = 'penboard-export'
): Promise<{ success: boolean; message?: string }> {
  if (strokes.length === 0) {
    return { success: false, message: 'キャンバスに描画内容がありません。' };
  }

  const bounds = calculateContentBounds(strokes);
  if (!bounds) {
    return { success: false, message: '描画の境界を計算できませんでした。' };
  }

  let contentWidth = bounds.maxX - bounds.minX + EXPORT_PADDING * 2;
  let contentHeight = bounds.maxY - bounds.minY + EXPORT_PADDING * 2;

  // Minimum dimensions
  contentWidth = Math.max(300, contentWidth);
  contentHeight = Math.max(200, contentHeight);

  // High-DPI multiplier (2x for crisp print/retina, scaled down if exceeding max bounds)
  let scale = 2;
  if (contentWidth * scale > MAX_EXPORT_DIMENSION || contentHeight * scale > MAX_EXPORT_DIMENSION) {
    scale = Math.min(MAX_EXPORT_DIMENSION / contentWidth, MAX_EXPORT_DIMENSION / contentHeight);
  }

  const canvasWidth = Math.round(contentWidth * scale);
  const canvasHeight = Math.round(contentHeight * scale);

  const offscreen = document.createElement('canvas');
  offscreen.width = canvasWidth;
  offscreen.height = canvasHeight;

  const ctx = offscreen.getContext('2d');
  if (!ctx) {
    return { success: false, message: 'Canvasコンテキストの作成に失敗しました。' };
  }

  // Draw pure white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Set transform to center and scale content
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(-bounds.minX + EXPORT_PADDING, -bounds.minY + EXPORT_PADDING);

  for (const stroke of strokes) {
    renderStrokeToContext(ctx, stroke);
  }

  ctx.restore();

  // Convert to Blob and trigger download
  return new Promise((resolve) => {
    offscreen.toBlob((blob) => {
      if (!blob) {
        resolve({ success: false, message: 'PNG画像の生成に失敗しました。' });
        return;
      }

      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}-${timestamp}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      resolve({ success: true });
    }, 'image/png');
  });
}
