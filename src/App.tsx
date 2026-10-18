/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { ConfirmModal } from './components/ConfirmModal';
import { WindowsSettingsModal } from './components/WindowsSettingsModal';
import {
  CanvasState,
  GridType,
  HistoryAction,
  PenColor,
  SaveStatus,
  Stroke,
  ToolType,
  ViewTransform,
} from './types/whiteboard';
import { calculateContentBounds } from './utils/math';
import { exportStrokesToPNG } from './utils/exporter';
import {
  exportToJSONFile,
  loadFromIndexedDB,
  parseAndValidateJSON,
  saveToIndexedDB,
} from './utils/storage';

export default function App() {
  const [tool, setTool] = useState<ToolType>('pen');
  const [penColor, setPenColor] = useState<PenColor>('#1e293b');
  const [penWidth, setPenWidth] = useState<number>(4);
  // Initial requirement: "初期設定は一定幅の筆圧オフにしてください"
  const [usePressure, setUsePressure] = useState<boolean>(false);
  const [gridType, setGridType] = useState<GridType>('none');
  const [view, setView] = useState<ViewTransform>({ panX: 0, panY: 0, zoom: 1.0 });

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [undoStack, setUndoStack] = useState<HistoryAction[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryAction[]>([]);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState<boolean>(false);
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);

  // Load saved canvas on initial mount
  useEffect(() => {
    let isMounted = true;
    async function initStorage() {
      try {
        const saved = await loadFromIndexedDB();
        if (saved && isMounted) {
          if (Array.isArray(saved.strokes)) {
            setStrokes(saved.strokes);
          }
          if (saved.view && typeof saved.view.zoom === 'number') {
            setView(saved.view);
          }
          if (saved.gridType) {
            setGridType(saved.gridType);
          }
          setSaveStatus('saved');
        }
      } catch (err) {
        console.error('Failed to load canvas state from IndexedDB:', err);
      }
    }
    initStorage();
    return () => {
      isMounted = false;
    };
  }, []);

  // Debounced auto-save function
  const triggerAutoSave = useCallback(
    (currentState: CanvasState) => {
      setSaveStatus('saving');
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = window.setTimeout(async () => {
        try {
          await saveToIndexedDB(currentState);
          setSaveStatus('saved');
        } catch (error) {
          console.error('Save to IndexedDB failed:', error);
          setSaveStatus('error');
        }
      }, 700);
    },
    []
  );

  // Trigger auto-save whenever strokes, view, or grid changes
  const handleStrokesChange = useCallback(
    (newStrokes: Stroke[]) => {
      setStrokes(newStrokes);
      triggerAutoSave({
        strokes: newStrokes,
        view,
        gridType,
      });
    },
    [gridType, triggerAutoSave, view]
  );

  const handleViewChange = useCallback(
    (newView: ViewTransform) => {
      setView(newView);
      triggerAutoSave({
        strokes,
        view: newView,
        gridType,
      });
    },
    [gridType, strokes, triggerAutoSave]
  );

  // Flush save on window unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
      saveToIndexedDB({ strokes, view, gridType }).catch(() => {});
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [gridType, strokes, view]);

  // History stack management
  const pushHistory = useCallback((action: HistoryAction) => {
    setUndoStack((prev) => [...prev.slice(-99), action]);
    setRedoStack([]); // Clear redo upon new action
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;

    const action = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);
    setUndoStack(newUndoStack);

    if (action.type === 'add_stroke') {
      const nextStrokes = strokes.filter((s) => s.id !== action.stroke.id);
      setStrokes(nextStrokes);
      setRedoStack((prev) => [...prev, action]);
      triggerAutoSave({ strokes: nextStrokes, view, gridType });
    } else if (action.type === 'erase_strokes') {
      // Re-insert erased strokes at their original index if possible
      const restored = [...strokes];
      for (const item of action.erasedStrokes) {
        const idx = Math.min(item.index, restored.length);
        restored.splice(idx, 0, item.stroke);
      }
      setStrokes(restored);
      setRedoStack((prev) => [...prev, action]);
      triggerAutoSave({ strokes: restored, view, gridType });
    } else if (action.type === 'clear_canvas') {
      const restored = [...action.previousStrokes];
      setStrokes(restored);
      setRedoStack((prev) => [...prev, action]);
      triggerAutoSave({ strokes: restored, view, gridType });
    }
  }, [gridType, strokes, triggerAutoSave, undoStack, view]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;

    const action = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);
    setRedoStack(newRedoStack);

    if (action.type === 'add_stroke') {
      const nextStrokes = [...strokes, action.stroke];
      setStrokes(nextStrokes);
      setUndoStack((prev) => [...prev, action]);
      triggerAutoSave({ strokes: nextStrokes, view, gridType });
    } else if (action.type === 'erase_strokes') {
      const idsToRemove = new Set(action.erasedStrokes.map((e) => e.stroke.id));
      const nextStrokes = strokes.filter((s) => !idsToRemove.has(s.id));
      setStrokes(nextStrokes);
      setUndoStack((prev) => [...prev, action]);
      triggerAutoSave({ strokes: nextStrokes, view, gridType });
    } else if (action.type === 'clear_canvas') {
      setStrokes([]);
      setUndoStack((prev) => [...prev, action]);
      triggerAutoSave({ strokes: [], view, gridType });
    }
  }, [gridType, redoStack, strokes, triggerAutoSave, view]);

  // Keyboard shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z, Space, P, E, H)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is inside a form input / modal
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Space bar for canvas panning
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
        return;
      }

      const isCtrlOrMeta = e.ctrlKey || e.metaKey;

      if (isCtrlOrMeta) {
        if (e.key === 'z' || e.key === 'Z') {
          e.preventDefault();
          if (e.shiftKey) {
            handleRedo();
          } else {
            handleUndo();
          }
          return;
        }

        if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          handleRedo();
          return;
        }

        if (e.key === 's' || e.key === 'S') {
          // Prevent browser default save page dialog, trigger JSON export instead
          e.preventDefault();
          exportToJSONFile({ strokes, view, gridType });
          return;
        }
      }

      // Single-key shortcuts
      if (!isCtrlOrMeta && !e.altKey && !e.shiftKey) {
        if (e.key === 'p' || e.key === 'P') {
          setTool('pen');
        } else if (e.key === 'e' || e.key === 'E') {
          setTool('eraser');
        } else if (e.key === 'h' || e.key === 'H') {
          setTool('pan');
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gridType, handleRedo, handleUndo, strokes, view]);

  // Zoom helpers
  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(5.0, view.zoom * 1.2);
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const newPanX = centerX - (centerX - view.panX) * (newZoom / view.zoom);
    const newPanY = centerY - (centerY - view.panY) * (newZoom / view.zoom);
    handleViewChange({ panX: newPanX, panY: newPanY, zoom: newZoom });
  }, [handleViewChange, view]);

  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(0.1, view.zoom / 1.2);
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const newPanX = centerX - (centerX - view.panX) * (newZoom / view.zoom);
    const newPanY = centerY - (centerY - view.panY) * (newZoom / view.zoom);
    handleViewChange({ panX: newPanX, panY: newPanY, zoom: newZoom });
  }, [handleViewChange, view]);

  const handleResetZoom = useCallback(() => {
    // Reset to 100% zoom centered
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const newPanX = centerX - (centerX - view.panX) * (1.0 / view.zoom);
    const newPanY = centerY - (centerY - view.panY) * (1.0 / view.zoom);
    handleViewChange({ panX: newPanX, panY: newPanY, zoom: 1.0 });
  }, [handleViewChange, view]);

  const handleFitContent = useCallback(() => {
    if (strokes.length === 0) {
      handleViewChange({ panX: 0, panY: 0, zoom: 1.0 });
      return;
    }

    const bounds = calculateContentBounds(strokes);
    if (!bounds) return;

    const contentWidth = bounds.maxX - bounds.minX;
    const contentHeight = bounds.maxY - bounds.minY;

    if (contentWidth <= 0 || contentHeight <= 0) {
      handleViewChange({ panX: 0, panY: 0, zoom: 1.0 });
      return;
    }

    const padding = 80;
    const availWidth = Math.max(200, window.innerWidth - padding * 2);
    const availHeight = Math.max(200, window.innerHeight - padding * 2);

    const fitZoom = Math.min(availWidth / contentWidth, availHeight / contentHeight, 2.0);
    const safeZoom = Math.max(0.1, fitZoom);

    const midContentX = (bounds.minX + bounds.maxX) / 2;
    const midContentY = (bounds.minY + bounds.maxY) / 2;

    const newPanX = window.innerWidth / 2 - midContentX * safeZoom;
    const newPanY = window.innerHeight / 2 - midContentY * safeZoom;

    handleViewChange({ panX: newPanX, panY: newPanY, zoom: safeZoom });
  }, [handleViewChange, strokes]);

  // Export JSON
  const handleExportJSON = useCallback(() => {
    exportToJSONFile({ strokes, view, gridType });
    setBannerNotice('JSONファイルとして保存しました。');
    setTimeout(() => setBannerNotice(null), 3000);
  }, [gridType, strokes, view]);

  // Import JSON
  const handleImportJSONClick = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result;
        if (typeof text !== 'string') return;

        const result = parseAndValidateJSON(text);
        if (!result.success) {
          // Keep current state intact, show error
          alert(`ファイルの読み込みに失敗しました:\n${result.error}`);
          return;
        }

        // Push previous strokes to undo stack so user can undo accidental import
        if (strokes.length > 0) {
          pushHistory({ type: 'clear_canvas', previousStrokes: strokes });
        }

        setStrokes(result.data.strokes);
        setView(result.data.view);
        setGridType(result.data.gridType);

        triggerAutoSave({
          strokes: result.data.strokes,
          view: result.data.view,
          gridType: result.data.gridType,
        });

        setBannerNotice(`JSONファイルを正常に読み込みました (${result.data.strokes.length}画)`);
        setTimeout(() => setBannerNotice(null), 3500);
      };

      reader.onerror = () => {
        alert('ファイルの読み込み中にエラーが発生しました。現在のキャンバスは保持されています。');
      };

      reader.readAsText(file);
    },
    [pushHistory, strokes, triggerAutoSave]
  );

  // Export PNG
  const handleExportPNG = useCallback(async () => {
    if (strokes.length === 0) {
      alert('キャンバスに何も描かれていません。');
      return;
    }
    const result = await exportStrokesToPNG(strokes);
    if (!result.success && result.message) {
      alert(result.message);
    } else if (result.success) {
      setBannerNotice('白背景PNG画像を書き出しました。');
      setTimeout(() => setBannerNotice(null), 3000);
    }
  }, [strokes]);

  // Clear Canvas (with undo support)
  const handleConfirmClear = useCallback(() => {
    if (strokes.length === 0) {
      setIsClearModalOpen(false);
      return;
    }
    pushHistory({ type: 'clear_canvas', previousStrokes: strokes });
    handleStrokesChange([]);
    setIsClearModalOpen(false);
    setBannerNotice('キャンバスを消去しました (Ctrl+Zで復元可能)');
    setTimeout(() => setBannerNotice(null), 3500);
  }, [handleStrokesChange, pushHistory, strokes]);

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none touch-none bg-neutral-100">
      {/* Hidden file input for JSON import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json,application/json"
        className="hidden"
      />

      {/* Primary Toolbar */}
      <Toolbar
        tool={tool}
        onToolChange={setTool}
        penColor={penColor}
        onPenColorChange={setPenColor}
        penWidth={penWidth}
        onPenWidthChange={setPenWidth}
        usePressure={usePressure}
        onTogglePressure={() => setUsePressure((prev) => !prev)}
        gridType={gridType}
        onToggleGrid={() => setGridType((prev) => (prev === 'grid' ? 'none' : 'grid'))}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        view={view}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
        onFitContent={handleFitContent}
        onExportJSON={handleExportJSON}
        onImportJSONClick={handleImportJSONClick}
        onExportPNG={handleExportPNG}
        onClearClick={() => setIsClearModalOpen(true)}
        onOpenHelp={() => setIsHelpOpen(true)}
        saveStatus={saveStatus}
        strokeCount={strokes.length}
      />

      {/* Main Drawing Canvas */}
      <Canvas
        tool={tool}
        penColor={penColor}
        penWidth={penWidth}
        usePressure={usePressure}
        gridType={gridType}
        view={view}
        onViewChange={handleViewChange}
        strokes={strokes}
        onStrokesChange={handleStrokesChange}
        onPushHistory={pushHistory}
        isSpacePressed={isSpacePressed}
      />

      {/* Non-intrusive bottom notification banner (does not block drawing area) */}
      {bannerNotice && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 px-4 py-2 bg-neutral-900/90 text-white text-xs font-medium rounded-lg shadow-md pointer-events-none transition-opacity">
          {bannerNotice}
        </div>
      )}

      {/* Clear Canvas Confirmation Modal */}
      <ConfirmModal
        isOpen={isClearModalOpen}
        title="キャンバスを全消去しますか？"
        message="現在の筆記内容がすべてクリアされます。"
        note="※全消去を実行した後でも、「元に戻す (Ctrl + Z)」で元に戻せます。"
        confirmLabel="すべて消去"
        cancelLabel="キャンセル"
        onConfirm={handleConfirmClear}
        onCancel={() => setIsClearModalOpen(false)}
      />

      {/* Windows & XPPen Settings Guide Modal */}
      <WindowsSettingsModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </div>
  );
}
