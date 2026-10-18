/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, ExternalLink, HelpCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface WindowsSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WindowsSettingsModal: React.FC<WindowsSettingsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white rounded-xl shadow-xl border border-neutral-200 overflow-hidden text-neutral-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-neutral-700" />
            <h2 className="text-base font-semibold text-neutral-900">
              Windows PCとXPPenの最適化・長押し無効化ガイド
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-700 rounded-md transition-colors"
            title="閉じる"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-5 text-sm leading-relaxed text-neutral-600">
          {/* Note on OS level constraint */}
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">Webアプリ外部（OS・ドライバー）の長押し判定について</p>
              <p>
                本アプリ内では長押し判定やホールドによるメニュー展開を完全に排除していますが、Windowsやペンタブドライバー自体が「長押し＝右クリック」として介入する場合があります。以下の設定を行うことで、より快適に紙のように筆記できます。
              </p>
            </div>
          </div>

          {/* Section 1 */}
          <div>
            <h3 className="font-semibold text-neutral-900 text-sm mb-2 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-neutral-100 text-neutral-800 flex items-center justify-center text-xs font-bold">
                1
              </span>
              Windows側の「長押しで右クリック」を無効にする
            </h3>
            <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-100 space-y-1.5 text-xs text-neutral-600">
              <p>1. Windowsの「設定」を開き、<strong>[Bluetoothとデバイス]</strong> → <strong>[ペンとWindows Ink]</strong> を選択します。</p>
              <p>2. クラシックな設定では、<strong>[コントロールパネル]</strong> → <strong>[ペンとタッチ]</strong> を開きます。</p>
              <p>3. <strong>「長押し（プレスアンドホールド）」</strong>の設定を開き、<strong>「右クリックの代わりに長押しを有効にする」のチェックを外します</strong>。</p>
              <p className="text-neutral-500">※これにより、ペン先を止めたときに円形の待機サークルが出なくなります。</p>
            </div>
          </div>

          {/* Section 2 */}
          <div>
            <h3 className="font-semibold text-neutral-900 text-sm mb-2 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-neutral-100 text-neutral-800 flex items-center justify-center text-xs font-bold">
                2
              </span>
              XPPen Pentabletドライバーの設定
            </h3>
            <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-100 space-y-1.5 text-xs text-neutral-600">
              <p>• <strong>Windows Inkの利用</strong>: XPPenの設定画面にある「Windows Ink」のチェックを入れておくと、ブラウザーでの筆圧取得が可能です。</p>
              <p>• <strong>筆圧不要で最速描画する場合</strong>: 本アプリの「筆圧」をオフにすると、筆圧計算をバイパスして一定線幅で最も安定した高速描画が行えます。</p>
              <p>• <strong>ペンのサイドボタン</strong>: 意図しない右クリック誤爆を防ぐため、必要に応じてXPPenドライバー側でサイドボタンを「無効」または「取り消し」等に設定できます。</p>
            </div>
          </div>

          {/* Section 3 */}
          <div>
            <h3 className="font-semibold text-neutral-900 text-sm mb-2 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-neutral-100 text-neutral-800 flex items-center justify-center text-xs font-bold">
                3
              </span>
              本アプリのキーボードショートカット
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 border border-neutral-100 rounded bg-neutral-50 flex items-center justify-between">
                <span>Space + ドラッグ</span>
                <kbd className="px-1.5 py-0.5 bg-white border border-neutral-200 rounded font-mono text-[11px]">移動 (Pan)</kbd>
              </div>
              <div className="p-2 border border-neutral-100 rounded bg-neutral-50 flex items-center justify-between">
                <span>マウスホイール</span>
                <kbd className="px-1.5 py-0.5 bg-white border border-neutral-200 rounded font-mono text-[11px]">拡大・縮小</kbd>
              </div>
              <div className="p-2 border border-neutral-100 rounded bg-neutral-50 flex items-center justify-between">
                <span>元に戻す</span>
                <kbd className="px-1.5 py-0.5 bg-white border border-neutral-200 rounded font-mono text-[11px]">Ctrl + Z</kbd>
              </div>
              <div className="p-2 border border-neutral-100 rounded bg-neutral-50 flex items-center justify-between">
                <span>やり直す</span>
                <kbd className="px-1.5 py-0.5 bg-white border border-neutral-200 rounded font-mono text-[11px]">Ctrl + Y / Shift+Z</kbd>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-neutral-50 border-t border-neutral-100 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg transition-colors cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
