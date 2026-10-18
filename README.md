# PenBoard

React + Viteで作成した手書きホワイトボードです。ElectronでWindows用exeを作成できます。

## Windowsアプリの作成

Node.jsとnpmを用意し、PowerShellで実行します。

```powershell
npm.cmd ci
npm.cmd run build:exe
```

`release/PenBoard-1.0.0-x64.exe` が生成されます。インストール不要で、ダブルクリックして起動できます。利用時にNode.jsや開発サーバーは不要です。初回ビルドには依存関係のダウンロード用インターネット接続が必要です。

このビルドはコード署名を付けていません。

描画はアプリ内のIndexedDBに自動保存されます。exeと同じフォルダーではなく、Windowsユーザーのアプリデータ領域に保存されます。ブラウザー版の保存データとは別です。移行やバックアップにはJSON書き出し・読み込みを使ってください。

## 開発

```powershell
npm.cmd run dev
```

ブラウザーで http://localhost:3000 を開きます。

```powershell
npm.cmd run desktop
```

Web部分をビルドしてElectronで起動します。

## 検証

```powershell
npm.cmd run lint
npm.cmd run build
```
