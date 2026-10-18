/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Point {
  x: number;
  y: number;
  pressure: number; // 0.0 ~ 1.0 (defaults to 0.5 when pressure is off or unsupported)
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export type PenColor = '#1e293b' | '#dc2626' | '#2563eb' | '#16a34a';

export type ToolType = 'pen' | 'eraser' | 'pan';

export interface Stroke {
  id: string;
  color: PenColor;
  baseWidth: number;
  usePressure: boolean;
  points: Point[];
  bounds: BoundingBox;
}

export interface ViewTransform {
  panX: number;
  panY: number;
  zoom: number;
}

export type GridType = 'none' | 'grid';

export interface CanvasState {
  strokes: Stroke[];
  view: ViewTransform;
  gridType: GridType;
}

export type HistoryAction =
  | { type: 'add_stroke'; stroke: Stroke }
  | { type: 'erase_strokes'; erasedStrokes: { stroke: Stroke; index: number }[] }
  | { type: 'clear_canvas'; previousStrokes: Stroke[] };

export interface PenBoardExportFile {
  app: 'PenBoard';
  version: 1;
  exportedAt: string;
  strokes: Stroke[];
  view: ViewTransform;
  gridType: GridType;
}

export type SaveStatus = 'saved' | 'saving' | 'error';
