#!/bin/bash
# バージョン番号を一括更新するスクリプト
# 使い方: ./scripts/bump-version.sh 1.2.0

set -euo pipefail

NEW_VERSION="${1:-}"

if [ -z "$NEW_VERSION" ]; then
  echo "Usage: $0 <new-version>"
  echo "Example: $0 1.2.0"
  exit 1
fi

# セマンティックバージョニング形式の検証
if ! echo "$NEW_VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "Error: Version must be in semver format (e.g., 1.2.0)"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# 現在のバージョンを取得
CURRENT_VERSION=$(grep -oP '"version":\s*"\K[^"]+' "$ROOT_DIR/manifest.json")
echo "Current version: $CURRENT_VERSION"
echo "New version:     $NEW_VERSION"

if [ "$CURRENT_VERSION" = "$NEW_VERSION" ]; then
  echo "Error: New version is the same as current version"
  exit 1
fi

# 1. manifest.json
sed -i "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" "$ROOT_DIR/manifest.json"
echo "Updated manifest.json"

# 2. README.md
sed -i "s/\*\*Version: $CURRENT_VERSION\*\*/\*\*Version: $NEW_VERSION\*\*/" "$ROOT_DIR/README.md"
echo "Updated README.md"

# 3. CHANGELOG.md にテンプレートを挿入
TODAY=$(date +%Y-%m-%d)
CHANGELOG="$ROOT_DIR/CHANGELOG.md"

# 既にそのバージョンのエントリがあるか確認
if grep -q "\[$NEW_VERSION\]" "$CHANGELOG"; then
  echo "CHANGELOG.md already has an entry for $NEW_VERSION (skipped)"
else
  sed -i "/^# Changelog$/a\\
\\
## [$NEW_VERSION] - $TODAY\\
\\
### Added\\
\\
### Changed\\
\\
### Fixed" "$CHANGELOG"
  echo "Updated CHANGELOG.md (template added - please fill in details)"
fi

echo ""
echo "Version bumped to $NEW_VERSION"
echo "Next steps:"
echo "  1. Edit CHANGELOG.md with release details"
echo "  2. git add -A && git commit -m 'Release v$NEW_VERSION'"
echo "  3. git tag v$NEW_VERSION"
