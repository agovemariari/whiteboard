/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Pen,
  Eraser,
  Hand,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid,
  Download,
  Upload,
  Image as ImageIcon,
  Trash2,
  HelpCircle,
  ChevronDown,
  Check,
  AlertCircle,
  Activity,
  Layers,
} from 'lucide-react';
import {
  GridType,
  PenColor,
  SaveStatus,
  ToolType,
  ViewTransform,
} from '../types/whiteboard';

interface ToolbarProps {
  tool: ToolType;
  onToolChange: (tool: ToolType) => void;
  penColor: PenColor;
  onPenColorChange: (color: PenColor) => void;
  penWidth: number;
  onPenWidthChange: (width: number) => void;
  usePressure: boolean;
  onTogglePressure: () => void;
  gridType: GridType;
  onToggleGrid: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  view: ViewTransform;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitContent: () => void;
  onExportJSON: () => void;
  onImportJSONClick: () => void;
  onExportPNG: () => void;
  onClearClick: () => void;
  onOpenHelp: () => void;
  saveStatus: SaveStatus;
  strokeCount: number;
}

const PEN_COLORS: { color: PenColor; label: string; bgClass: string }[] = [
  { color: '#1e293b', label: '黒 (墨)', bgClass: 'bg-slate-900' },
  { color: '#dc2626', label: '赤 (朱)', bgClass: 'bg-red-600' },
  { color: '#2563eb', label: '青 (藍)', bgClass: 'bg-blue-600' },
  { color: '#16a34a', label: '緑 (草)', bgClass: 'bg-emerald-600' },
];

const PEN_WIDTHS = [
  { width: 2, label: '極細 (2px)', dotSize: 4 },
  { width: 4, label: '標準 (4px)', dotSize: 7 },
  { width: 8, label: '太線 (8px)', dotSize: 11 },
  { width: 14, label: '極太 (14px)', dotSize: 15 },
];

export const Toolbar: React.FC<ToolbarProps> = ({
  tool,
  onToolChange,
  penColor,
  onPenColorChange,
  penWidth,
  onPenWidthChange,
  usePressure,
  onTogglePressure,
  gridType,
  onToggleGrid,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  view,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitContent,
  onExportJSON,
  onImportJSONClick,
  onExportPNG,
  onClearClick,
  onOpenHelp,
  saveStatus,
  strokeCount,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isMenuOpen]);

  const zoomPercent = Math.round(view.zoom * 100);

  return (
    <header className="absolute top-3 inset-x-3 pointer-events-none z-30 flex items-start justify-between gap-3">
      {/* Main floating control center */}
      <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 p-1.5 bg-white/95 backdrop-blur-md rounded-xl shadow-sm border border-neutral-200/90 text-neutral-800">
        {/* App Title / Brand wordmark */}
        <div className="flex items-center gap-2 pl-2 pr-3 py-1 border-r border-neutral-200/80">
          <span className="text-xs font-bold tracking-tight text-neutral-900 whitespace-nowrap">
            PenBoard
          </span>
          {/* Subtle strokes counter */}
          <span className="text-[11px] text-neutral-400 font-mono tabular-nums whitespace-nowrap" title="総ストローク数">
            {strokeCount}画
          </span>
        </div>

        {/* Primary Tool selection: Pen, Eraser, Pan */}
        <div className="flex items-center bg-neutral-100 p-0.5 rounded-lg border border-neutral-200/50">
          <button
            onClick={() => onToolChange('pen')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer whitespace-nowrap ${
              tool === 'pen'
                ? 'bg-white text-neutral-900 shadow-xs font-semibold'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
            title="ペンツール (P)"
            aria-label="ペンツール"
          >
            <Pen className="w-3.5 h-3.5" />
            <span>ペン</span>
          </button>

          <button
            onClick={() => onToolChange('eraser')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer whitespace-nowrap ${
              tool === 'eraser'
                ? 'bg-white text-neutral-900 shadow-xs font-semibold'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
            title="消しゴムツール (一筆単位で消去 / E)"
            aria-label="消しゴムツール"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>消しゴム</span>
          </button>

          <button
            onClick={() => onToolChange('pan')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer whitespace-nowrap ${
              tool === 'pan'
                ? 'bg-white text-neutral-900 shadow-xs font-semibold'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
            title="キャンバス移動 (Spaceキー押しながらドラッグでも可能 / H)"
            aria-label="キャンバス移動"
          >
            <Hand className="w-3.5 h-3.5" />
            <span>移動</span>
          </button>
        </div>

        {/* Color Palette (Active when pen tool selected) */}
        <div className="flex items-center gap-1 px-1.5 py-0.5 border-r border-neutral-200/80">
          {PEN_COLORS.map(({ color, label, bgClass }) => {
            const isSelected = penColor === color && tool === 'pen';
            return (
              <button
                key={color}
                onClick={() => {
                  onPenColorChange(color);
                  if (tool !== 'pen') onToolChange('pen');
                }}
                className={`relative w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer ${bgClass} ${
                  isSelected ? 'ring-2 ring-neutral-900 ring-offset-2 scale-110' : 'opacity-80 hover:opacity-100 hover:scale-105'
                }`}
                title={label}
                aria-label={label}
              >
                {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
              </button>
            );
          })}
        </div>

        {/* Stroke Width Selector */}
        <div className="flex items-center gap-1 px-1.5 py-0.5 border-r border-neutral-200/80">
          {PEN_WIDTHS.map(({ width, label, dotSize }) => {
            const isSelected = penWidth === width;
            return (
              <button
                key={width}
                onClick={() => onPenWidthChange(width)}
                className={`w-7 h-7 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-neutral-200/80 text-neutral-900'
                    : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800'
                }`}
                title={label}
                aria-label={label}
              >
                <span
                  className="rounded-full bg-current transition-all"
                  style={{ width: `${dotSize}px`, height: `${dotSize}px` }}
                />
              </button>
            );
          })}
        </div>

        {/* Pressure Sensitivity Toggle (Default: OFF / Constant width) */}
        <button
          onClick={onTogglePressure}
          className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            usePressure
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-neutral-50 border-neutral-200/70 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
          }`}
          title={
            usePressure
              ? '筆圧検知: オン (ペンの圧力で線の太さが変化)'
              : '筆圧検知: オフ (一定線幅で紙のように確実な書き味)'
          }
          aria-label="筆圧切り替え"
        >
          <Activity className="w-3.5 h-3.5" />
          <span>筆圧 {usePressure ? 'ON' : 'OFF'}</span>
        </button>

        {/* Background Grid Toggle */}
        <button
          onClick={onToggleGrid}
          className={`p-1.5 text-xs rounded-lg border transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
            gridType === 'grid'
              ? 'bg-neutral-900 border-neutral-900 text-white'
              : 'bg-neutral-50 border-neutral-200/70 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
          }`}
          title={gridType === 'grid' ? '方眼背景を非表示 (白無地)' : '方眼背景を表示'}
          aria-label="背景方眼切り替え"
        >
          <Grid className="w-4 h-4" />
        </button>

        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 px-1 border-l border-neutral-200/80">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
              canUndo
                ? 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
                : 'text-neutral-300 cursor-not-allowed'
            }`}
            title="元に戻す (Ctrl + Z)"
            aria-label="元に戻す"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
              canRedo
                ? 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
                : 'text-neutral-300 cursor-not-allowed'
            }`}
            title="やり直す (Ctrl + Y / Ctrl + Shift + Z)"
            aria-label="やり直す"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 pl-1 border-l border-neutral-200/80">
          <button
            onClick={onZoomOut}
            className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors cursor-pointer"
            title="縮小 (マウスホイール手前)"
            aria-label="縮小"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onResetZoom}
            className="px-1.5 py-1 text-xs font-mono tabular-nums font-medium text-neutral-700 hover:bg-neutral-100 rounded transition-colors cursor-pointer"
            title="クリックで拡大率を100%にリセット"
          >
            {zoomPercent}%
          </button>

          <button
            onClick={onZoomIn}
            className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors cursor-pointer"
            title="拡大 (マウスホイール奥)"
            aria-label="拡大"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onFitContent}
            className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors cursor-pointer"
            title="書いた内容全体を表示"
            aria-label="全体表示"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* File & Actions Dropdown */}
        <div className="relative pl-1 border-l border-neutral-200/80" ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer whitespace-nowrap"
            title="ファイル保存・読み込み・画像出力・設定"
            aria-label="メニュー"
          >
            <span>ファイル</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-80" />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-xl shadow-lg border border-neutral-200 py-1.5 text-xs text-neutral-700 z-50">
              <button
                onClick={() => {
                  onExportJSON();
                  setIsMenuOpen(false);
                }}
                className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-neutral-50 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 text-neutral-500" />
                <div>
                  <div className="font-medium text-neutral-900">JSONファイルに保存</div>
                  <div className="text-[11px] text-neutral-400">線の座標・色を再編集可能</div>
                </div>
              </button>

              <button
                onClick={() => {
                  onImportJSONClick();
                  setIsMenuOpen(false);
                }}
                className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-neutral-50 transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4 text-neutral-500" />
                <div>
                  <div className="font-medium text-neutral-900">JSONファイルを読み込む</div>
                  <div className="text-[11px] text-neutral-400">保存した図を読み込んで再開</div>
                </div>
              </button>

              <button
                onClick={() => {
                  onExportPNG();
                  setIsMenuOpen(false);
                }}
                className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-neutral-50 transition-colors cursor-pointer"
              >
                <ImageIcon className="w-4 h-4 text-neutral-500" />
                <div>
                  <div className="font-medium text-neutral-900">白背景PNG画像で保存</div>
                  <div className="text-[11px] text-neutral-400">全体を収めて画像書き出し</div>
                </div>
              </button>

              <div className="my-1 border-t border-neutral-100" />

              <button
                onClick={() => {
                  onOpenHelp();
                  setIsMenuOpen(false);
                }}
                className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-neutral-50 transition-colors cursor-pointer"
              >
                <HelpCircle className="w-4 h-4 text-blue-600" />
                <div>
                  <div className="font-medium text-neutral-900">ペンタブ・長押し設定ガイド</div>
                  <div className="text-[11px] text-neutral-400">Windows・XPPen設定手順</div>
                </div>
              </button>

              <div className="my-1 border-t border-neutral-100" />

              <button
                onClick={() => {
                  onClearClick();
                  setIsMenuOpen(false);
                }}
                className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-red-50 text-red-600 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <div>
                  <div className="font-medium">キャンバスを全消去...</div>
                  <div className="text-[11px] text-red-400">元に戻す(Ctrl+Z)で復元可能</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Auto-Save & System Status Badge (Top right, quiet, unboxed text per Zero-Pill rules) */}
      <div className="pointer-events-auto flex items-center gap-2 px-3 py-2 bg-white/95 backdrop-blur-md rounded-xl shadow-xs border border-neutral-200/90 text-xs">
        {saveStatus === 'saved' && (
          <div className="flex items-center gap-1.5 text-neutral-600">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-medium">端末内保存済み</span>
          </div>
        )}
        {saveStatus === 'saving' && (
          <div className="flex items-center gap-1.5 text-neutral-500">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>保存中...</span>
          </div>
        )}
        {saveStatus === 'error' && (
          <div className="flex items-center gap-1.5 text-red-600">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>保存失敗</span>
            <button
              onClick={onExportJSON}
              className="ml-1 text-[11px] underline text-red-700 hover:text-red-900 font-medium cursor-pointer"
              title="データをJSONファイルとしてダウンロードします"
            >
              今すぐJSON退避
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
