/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CanvasState, PenBoardExportFile, Stroke } from '../types/whiteboard';
import { calculateStrokeBounds } from './math';

const DB_NAME = 'PenBoard_Database';
const DB_VERSION = 1;
const STORE_NAME = 'whiteboard_state';
const STATE_KEY = 'primary_canvas';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open IndexedDB'));
    };
  });
}

/**
 * Save canvas state to IndexedDB
 */
export async function saveToIndexedDB(state: CanvasState): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(state, STATE_KEY);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to write to IndexedDB'));
      };

      transaction.oncomplete = () => {
        db.close();
      };

      transaction.onerror = () => {
        reject(transaction.error || new Error('Transaction error'));
      };
    });
  } catch (err) {
    // Attempt localStorage fallback if IndexedDB throws
    try {
      localStorage.setItem(`penboard_fallback_${STATE_KEY}`, JSON.stringify(state));
      return;
    } catch {
      throw err;
    }
  }
}

/**
 * Load canvas state from IndexedDB
 */
export async function loadFromIndexedDB(): Promise<CanvasState | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(STATE_KEY);

      request.onsuccess = () => {
        const result = request.result as CanvasState | undefined;
        resolve(result || null);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to read from IndexedDB'));
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch {
    // Try localStorage fallback
    try {
      const raw = localStorage.getItem(`penboard_fallback_${STATE_KEY}`);
      if (raw) {
        return JSON.parse(raw) as CanvasState;
      }
    } catch {
      // ignore
    }
    return null;
  }
}

/**
 * Export editable JSON file with versioning
 */
export function exportToJSONFile(state: CanvasState, baseFilename = 'penboard-drawing'): void {
  const exportPayload: PenBoardExportFile = {
    app: 'PenBoard',
    version: 1,
    exportedAt: new Date().toISOString(),
    strokes: state.strokes,
    view: state.view,
    gridType: state.gridType,
  };

  const jsonStr = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseFilename}-${timestamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Validate and safely parse an imported JSON file
 */
export function parseAndValidateJSON(
  jsonText: string
): { success: true; data: CanvasState } | { success: false; error: string } {
  try {
    const parsed = JSON.parse(jsonText);

    if (!parsed || typeof parsed !== 'object') {
      return { success: false, error: 'JSONデータがオブジェクトではありません。' };
    }

    if (!Array.isArray(parsed.strokes)) {
      return { success: false, error: '有効なストロークデータ（strokes）が見つかりません。' };
    }

    // Validate strokes structure
    const validatedStrokes: Stroke[] = [];
    for (let i = 0; i < parsed.strokes.length; i++) {
      const s = parsed.strokes[i];
      if (!s || typeof s !== 'object' || !Array.isArray(s.points)) {
        continue; // Skip corrupted stroke rather than crashing
      }

      const validPoints = s.points
        .filter((p: unknown) => p && typeof p === 'object' && 'x' in p && 'y' in p)
        .map((p: { x: number; y: number; pressure?: number }) => ({
          x: Number(p.x) || 0,
          y: Number(p.y) || 0,
          pressure: typeof p.pressure === 'number' ? Math.max(0, Math.min(1, p.pressure)) : 0.5,
        }));

      if (validPoints.length === 0) continue;

      const baseWidth = typeof s.baseWidth === 'number' && s.baseWidth > 0 ? s.baseWidth : 4;
      const color = typeof s.color === 'string' && s.color ? s.color : '#1e293b';
      const usePressure = Boolean(s.usePressure);
      const id = typeof s.id === 'string' && s.id ? s.id : `stroke_${Date.now()}_${i}`;

      const bounds =
        s.bounds && typeof s.bounds.minX === 'number'
          ? s.bounds
          : calculateStrokeBounds(validPoints, baseWidth);

      validatedStrokes.push({
        id,
        color: color as Stroke['color'],
        baseWidth,
        usePressure,
        points: validPoints,
        bounds,
      });
    }

    const defaultView = { panX: 0, panY: 0, zoom: 1 };
    const view =
      parsed.view &&
      typeof parsed.view.panX === 'number' &&
      typeof parsed.view.panY === 'number' &&
      typeof parsed.view.zoom === 'number'
        ? {
            panX: parsed.view.panX,
            panY: parsed.view.panY,
            zoom: Math.max(0.05, Math.min(10, parsed.view.zoom)),
          }
        : defaultView;

    const gridType = parsed.gridType === 'grid' ? 'grid' : 'none';

    return {
      success: true,
      data: {
        strokes: validatedStrokes,
        view,
        gridType,
      },
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'JSONの構文解析に失敗しました。';
    return { success: false, error: message };
  }
}
