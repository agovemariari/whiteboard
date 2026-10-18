/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useCallback } from 'react';
import {
  BoundingBox,
  CanvasState,
  GridType,
  HistoryAction,
  PenColor,
  Point,
  Stroke,
  ToolType,
  ViewTransform,
} from '../types/whiteboard';
import {
  calculateStrokeBounds,
  doesEraserSweepHitStroke,
  isBoundsIntersecting,
  screenToWorld,
} from '../utils/math';
import { renderStrokeToContext } from '../utils/exporter';

interface CanvasProps {
  tool: ToolType;
  penColor: PenColor;
  penWidth: number;
  usePressure: boolean;
  gridType: GridType;
  view: ViewTransform;
  onViewChange: (newView: ViewTransform) => void;
  strokes: Stroke[];
  onStrokesChange: (newStrokes: Stroke[]) => void;
  onPushHistory: (action: HistoryAction) => void;
  isSpacePressed: boolean;
}

export const Canvas: React.FC<CanvasProps> = ({
  tool,
  penColor,
  penWidth,
  usePressure,
  gridType,
  view,
  onViewChange,
  strokes,
  onStrokesChange,
  onPushHistory,
  isSpacePressed,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Mutable ref holding internal engine state to bypass React re-renders during high-frequency pointer drawing
  const engineRef = useRef<{
    strokes: Stroke[];
    activeStroke: Stroke | null;
    activePointerId: number | null;
    activeInteraction: 'drawing' | 'erasing' | 'panning' | null;
    erasedThisGesture: { stroke: Stroke; index: number }[];
    lastEraserPoint: Point | null;
    lastPanClient: { x: number; y: number } | null;
    cursorPos: { x: number; y: number } | null;
    view: ViewTransform;
    tool: ToolType;
    penColor: PenColor;
    penWidth: number;
    usePressure: boolean;
    gridType: GridType;
    isSpacePressed: boolean;
    dpr: number;
    needsRedraw: boolean;
    rafId: number | null;
  }>({
    strokes: strokes,
    activeStroke: null,
    activePointerId: null,
    activeInteraction: null,
    erasedThisGesture: [],
    lastEraserPoint: null,
    lastPanClient: null,
    cursorPos: null,
    view: view,
    tool: tool,
    penColor: penColor,
    penWidth: penWidth,
    usePressure: usePressure,
    gridType: gridType,
    isSpacePressed: isSpacePressed,
    dpr: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    needsRedraw: true,
    rafId: null,
  });

  // Sync prop changes into mutable ref
  useEffect(() => {
    engineRef.current.tool = tool;
    engineRef.current.penColor = penColor;
    engineRef.current.penWidth = penWidth;
    engineRef.current.usePressure = usePressure;
    engineRef.current.gridType = gridType;
    engineRef.current.isSpacePressed = isSpacePressed;
  }, [tool, penColor, penWidth, usePressure, gridType, isSpacePressed]);

  // Sync strokes from outside (e.g. on Undo/Redo/Load/Clear)
  useEffect(() => {
    engineRef.current.strokes = strokes;
    engineRef.current.needsRedraw = true;
  }, [strokes]);

  // Sync view from outside (e.g. 100% Reset / Fit to Content)
  useEffect(() => {
    engineRef.current.view = view;
    engineRef.current.needsRedraw = true;
  }, [view]);

  // Redraw canvas
  const drawScene = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { strokes: currentStrokes, activeStroke, view: currentView, gridType: currentGrid, dpr } =
      engineRef.current;

    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    // Reset transform & clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fill clean white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply device pixel ratio
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Draw grid if enabled
    if (currentGrid === 'grid') {
      const gridSize = 32 * currentView.zoom;
      // Only render grid if zoomed enough to avoid moire patterns
      if (gridSize >= 10) {
        ctx.save();
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;

        const startX = (currentView.panX % gridSize + gridSize) % gridSize;
        const startY = (currentView.panY % gridSize + gridSize) % gridSize;

        ctx.beginPath();
        for (let x = startX; x <= width; x += gridSize) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
        }
        for (let y = startY; y <= height; y += gridSize) {
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
        }
        ctx.stroke();
        ctx.restore();
      }
    }

    // World transform
    ctx.save();
    ctx.translate(currentView.panX, currentView.panY);
    ctx.scale(currentView.zoom, currentView.zoom);

    // Visible world bounding box for culling
    const visibleBounds: BoundingBox = {
      minX: (0 - currentView.panX) / currentView.zoom,
      minY: (0 - currentView.panY) / currentView.zoom,
      maxX: (width - currentView.panX) / currentView.zoom,
      maxY: (height - currentView.panY) / currentView.zoom,
    };

    // Render strokes with viewport culling
    for (const stroke of currentStrokes) {
      if (!isBoundsIntersecting(stroke.bounds, visibleBounds)) {
        continue;
      }
      renderStrokeToContext(ctx, stroke);
    }

    // Render active stroke (in progress)
    if (activeStroke) {
      renderStrokeToContext(ctx, activeStroke);
    }

    ctx.restore();

    // Draw subtle eraser cursor overlay if eraser tool active
    if (
      engineRef.current.tool === 'eraser' &&
      engineRef.current.cursorPos &&
      !engineRef.current.isSpacePressed
    ) {
      const { x, y } = engineRef.current.cursorPos;
      const radius = 14;
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.fillStyle = 'rgba(241, 245, 249, 0.25)';
      ctx.fill();
      ctx.restore();
    }
  }, []);

  // Animation frame loop
  useEffect(() => {
    let animId: number;
    const loop = () => {
      if (engineRef.current.needsRedraw) {
        drawScene();
        engineRef.current.needsRedraw = false;
      }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [drawScene]);

  // Resize canvas to full viewport with DPR compensation
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    engineRef.current.dpr = dpr;

    const width = window.innerWidth;
    const height = window.innerHeight;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    engineRef.current.needsRedraw = true;
  }, []);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [handleResize]);

  // Pointer Event Handlers
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      // Suppress any default browser drag / text selection
      e.preventDefault();

      const canvas = canvasRef.current;
      if (!canvas) return;

      // Only handle primary button (pen tip or left click)
      if (e.buttons !== 1 && e.button !== 0) {
        return;
      }

      // If already capturing another pointer, ignore
      if (engineRef.current.activePointerId !== null) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      const pointerId = e.pointerId;
      engineRef.current.activePointerId = pointerId;

      try {
        canvas.setPointerCapture(pointerId);
      } catch {
        // ignore fallback
      }

      const isPanning =
        engineRef.current.isSpacePressed || engineRef.current.tool === 'pan';

      if (isPanning) {
        engineRef.current.activeInteraction = 'panning';
        engineRef.current.lastPanClient = { x: e.clientX, y: e.clientY };
        return;
      }

      if (engineRef.current.tool === 'eraser') {
        engineRef.current.activeInteraction = 'erasing';
        engineRef.current.erasedThisGesture = [];

        const worldPt = screenToWorld(screenX, screenY, engineRef.current.view);
        const eraserPoint: Point = { x: worldPt.x, y: worldPt.y, pressure: 0.5 };
        engineRef.current.lastEraserPoint = eraserPoint;

        // Check immediate hit on pointer down (in case user clicks on a stroke)
        const eraserRadius = 14 / engineRef.current.view.zoom;
        const currentStrokes = [...engineRef.current.strokes];
        const remainingStrokes: Stroke[] = [];
        let hitAny = false;

        for (let i = 0; i < currentStrokes.length; i++) {
          const s = currentStrokes[i];
          if (doesEraserSweepHitStroke(eraserPoint, eraserPoint, s, eraserRadius)) {
            engineRef.current.erasedThisGesture.push({ stroke: s, index: i });
            hitAny = true;
          } else {
            remainingStrokes.push(s);
          }
        }

        if (hitAny) {
          engineRef.current.strokes = remainingStrokes;
          engineRef.current.needsRedraw = true;
        }
        return;
      }

      // Pen mode: Start drawing immediately without any delay or long-press timers
      engineRef.current.activeInteraction = 'drawing';

      const worldPt = screenToWorld(screenX, screenY, engineRef.current.view);
      const pressure =
        engineRef.current.usePressure && typeof e.pressure === 'number' && e.pressure > 0
          ? e.pressure
          : 0.5;

      const initialPoint: Point = {
        x: worldPt.x,
        y: worldPt.y,
        pressure,
      };

      const newStroke: Stroke = {
        id: `stroke_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        color: engineRef.current.penColor,
        baseWidth: engineRef.current.penWidth,
        usePressure: engineRef.current.usePressure,
        points: [initialPoint],
        bounds: calculateStrokeBounds([initialPoint], engineRef.current.penWidth),
      };

      engineRef.current.activeStroke = newStroke;
      engineRef.current.needsRedraw = true;
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      // Update cursor position for hover & eraser ring
      engineRef.current.cursorPos = { x: screenX, y: screenY };

      // Hover rejection: If no buttons are pressed, DO NOT DRAW!
      if (e.buttons === 0) {
        if (engineRef.current.activeStroke) {
          // Finalize stroke if button was released outside without trigger
          finalizeActiveInteraction();
        }
        if (engineRef.current.tool === 'eraser') {
          engineRef.current.needsRedraw = true;
        }
        return;
      }

      if (e.pointerId !== engineRef.current.activePointerId) {
        return;
      }

      const interaction = engineRef.current.activeInteraction;
      if (!interaction) return;

      // Process coalesced events if available (captures 100-240Hz pen tablet micro-points)
      const nativeEvent = e.nativeEvent as PointerEvent;
      const coalescedEvents =
        typeof nativeEvent.getCoalescedEvents === 'function'
          ? nativeEvent.getCoalescedEvents()
          : [nativeEvent];

      if (interaction === 'panning') {
        if (engineRef.current.lastPanClient) {
          const dx = e.clientX - engineRef.current.lastPanClient.x;
          const dy = e.clientY - engineRef.current.lastPanClient.y;
          engineRef.current.lastPanClient = { x: e.clientX, y: e.clientY };

          const updatedView = {
            ...engineRef.current.view,
            panX: engineRef.current.view.panX + dx,
            panY: engineRef.current.view.panY + dy,
          };
          engineRef.current.view = updatedView;
          engineRef.current.needsRedraw = true;
        }
        return;
      }

      if (interaction === 'erasing') {
        const eraserRadius = 14 / engineRef.current.view.zoom;
        let currentStrokes = [...engineRef.current.strokes];
        let hitAny = false;

        for (const evt of coalescedEvents) {
          const curScreenX = evt.clientX - rect.left;
          const curScreenY = evt.clientY - rect.top;
          const curWorld = screenToWorld(curScreenX, curScreenY, engineRef.current.view);
          const curPoint: Point = { x: curWorld.x, y: curWorld.y, pressure: 0.5 };

          const prevPoint = engineRef.current.lastEraserPoint || curPoint;

          const remainingStrokes: Stroke[] = [];
          for (let i = 0; i < currentStrokes.length; i++) {
            const s = currentStrokes[i];
            if (doesEraserSweepHitStroke(prevPoint, curPoint, s, eraserRadius)) {
              engineRef.current.erasedThisGesture.push({ stroke: s, index: i });
              hitAny = true;
            } else {
              remainingStrokes.push(s);
            }
          }

          currentStrokes = remainingStrokes;
          engineRef.current.lastEraserPoint = curPoint;
        }

        if (hitAny) {
          engineRef.current.strokes = currentStrokes;
          engineRef.current.needsRedraw = true;
        }
        return;
      }

      if (interaction === 'drawing' && engineRef.current.activeStroke) {
        const activeStroke = engineRef.current.activeStroke;
        const pts = activeStroke.points;

        for (const evt of coalescedEvents) {
          const curScreenX = evt.clientX - rect.left;
          const curScreenY = evt.clientY - rect.top;
          const curWorld = screenToWorld(curScreenX, curScreenY, engineRef.current.view);

          const pressure =
            engineRef.current.usePressure && typeof evt.pressure === 'number' && evt.pressure > 0
              ? evt.pressure
              : 0.5;

          const newPt: Point = {
            x: curWorld.x,
            y: curWorld.y,
            pressure,
          };

          // Light distance filter to avoid exact duplicate micro-points while preserving crisp kanji corners
          const lastPt = pts[pts.length - 1];
          const distSq = (newPt.x - lastPt.x) ** 2 + (newPt.y - lastPt.y) ** 2;
          if (distSq >= 0.25) {
            pts.push(newPt);
          }
        }

        // Update bounds dynamically
        activeStroke.bounds = calculateStrokeBounds(pts, activeStroke.baseWidth);
        engineRef.current.needsRedraw = true;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const finalizeActiveInteraction = useCallback(() => {
    const canvas = canvasRef.current;
    const pointerId = engineRef.current.activePointerId;

    if (pointerId !== null && canvas) {
      try {
        canvas.releasePointerCapture(pointerId);
      } catch {
        // ignore
      }
    }

    const interaction = engineRef.current.activeInteraction;

    if (interaction === 'panning') {
      onViewChange({ ...engineRef.current.view });
    } else if (interaction === 'drawing' && engineRef.current.activeStroke) {
      const finishedStroke = engineRef.current.activeStroke;
      // Ensure single-tap points remain valid dots
      if (finishedStroke.points.length > 0) {
        finishedStroke.bounds = calculateStrokeBounds(
          finishedStroke.points,
          finishedStroke.baseWidth
        );
        const nextStrokes = [...engineRef.current.strokes, finishedStroke];
        engineRef.current.strokes = nextStrokes;
        onStrokesChange(nextStrokes);
        onPushHistory({ type: 'add_stroke', stroke: finishedStroke });
      }
      engineRef.current.activeStroke = null;
    } else if (interaction === 'erasing') {
      if (engineRef.current.erasedThisGesture.length > 0) {
        const nextStrokes = [...engineRef.current.strokes];
        onStrokesChange(nextStrokes);
        onPushHistory({
          type: 'erase_strokes',
          erasedStrokes: [...engineRef.current.erasedThisGesture],
        });
      }
    }

    engineRef.current.activePointerId = null;
    engineRef.current.activeInteraction = null;
    engineRef.current.lastEraserPoint = null;
    engineRef.current.lastPanClient = null;
    engineRef.current.erasedThisGesture = [];
    engineRef.current.needsRedraw = true;
  }, [onPushHistory, onStrokesChange, onViewChange]);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (e.pointerId === engineRef.current.activePointerId) {
        finalizeActiveInteraction();
      }
    },
    [finalizeActiveInteraction]
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (e.pointerId === engineRef.current.activePointerId) {
        finalizeActiveInteraction();
      }
    },
    [finalizeActiveInteraction]
  );

  // Window blur / focus loss handling: prevent stuck strokes
  useEffect(() => {
    const handleWindowBlur = () => {
      if (engineRef.current.activePointerId !== null) {
        finalizeActiveInteraction();
      }
    };
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [finalizeActiveInteraction]);

  // Non-passive wheel handler for cursor-centered zooming
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault();

      const rect = canvas.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      const currentView = engineRef.current.view;
      const zoomFactor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const newZoom = Math.max(0.1, Math.min(5.0, currentView.zoom * zoomFactor));

      // Zoom centered at cursor
      const newPanX = cursorX - (cursorX - currentView.panX) * (newZoom / currentView.zoom);
      const newPanY = cursorY - (cursorY - currentView.panY) * (newZoom / currentView.zoom);

      const updatedView = {
        panX: newPanX,
        panY: newPanY,
        zoom: newZoom,
      };

      engineRef.current.view = updatedView;
      engineRef.current.needsRedraw = true;
      onViewChange(updatedView);
    };

    canvas.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheelNative);
    };
  }, [onViewChange]);

  // Prevent browser context menu anywhere on drawing area
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // Determine cursor styling
  let cursorClass = 'cursor-crosshair';
  if (isSpacePressed || tool === 'pan') {
    cursorClass = engineRef.current.activeInteraction === 'panning' ? 'cursor-grabbing' : 'cursor-grab';
  } else if (tool === 'eraser') {
    cursorClass = 'cursor-crosshair';
  }

  return (
    <div className="relative w-full h-full overflow-hidden select-none touch-none bg-white">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={finalizeActiveInteraction}
        onContextMenu={handleContextMenu}
        className={`block w-full h-full ${cursorClass} touch-none select-none`}
        style={{
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
      />
    </div>
  );
};
