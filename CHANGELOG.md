# Changelog

## [1.2.0] - 2026-03-19

### Added
- バージョン一括更新スクリプト (`scripts/bump-version.sh`)

### Changed
- popup.js を IIFE + strict mode でラップしグローバルスコープ汚染を防止
- 試合検索範囲のマジックナンバーを `MAX_DAILY_MATCHES` 定数に変更
- テーマ切替時にポップアップUIのレート変動色もテーマに連動
- デモデータの構造を実データ (`{x, y}`) と統一
- ダウンロードファイル名をローカル日付基準に変更

### Fixed
- Clipboard API のエラーハンドリング追加 (blob null チェック、catch 追加)
- content.js の未使用変数 (`rateSection`, `allText`) を削除
- `dailyChange` の二重チェックを解消

## [1.1.0] - 2026-03-17

### Added
- 4種類のカードテーマ（Dark / Ocean / Crimson / Light）
- デモモード（対戦データがなくても動作確認可能）
- 戦績テキストのクリップボードコピー

### Fixed
- レート検出の精度向上
- イベントリスナーの重複登録防止
- winRate の型不整合を修正
- エラーハンドリングの改善

## [1.0.0] - 2026-03-17

### Added
- 今日の勝敗数・勝率の自動集計
- レート変動（開始 → 終了）のグラフ付き表示
- 戦績カード画像の自動生成
- 画像のコピー・ダウンロード・X(Twitter)への共有
