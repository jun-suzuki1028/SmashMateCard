#!/bin/bash
# バージョン番号を一括更新し、リリースまで実行するスクリプト
#
# 使い方:
#   ./scripts/bump-version.sh 1.2.0          # バージョン更新のみ
#   ./scripts/bump-version.sh 1.2.0 --release # コミット・タグ・pushまで実行

set -euo pipefail

NEW_VERSION="${1:-}"
DO_RELEASE="${2:-}"

if [ -z "$NEW_VERSION" ]; then
  echo "Usage: $0 <new-version> [--release]"
  echo ""
  echo "Examples:"
  echo "  $0 1.2.0            # Update version numbers only"
  echo "  $0 1.2.0 --release  # Update, commit, tag, and push"
  exit 1
fi

# セマンティックバージョニング形式の検証
if ! echo "$NEW_VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "Error: Version must be in semver format (e.g., 1.2.0)"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

# 現在のバージョンを取得
CURRENT_VERSION=$(grep -oP '"version":\s*"\K[^"]+' manifest.json)
echo "Current version: $CURRENT_VERSION"
echo "New version:     $NEW_VERSION"

if [ "$CURRENT_VERSION" = "$NEW_VERSION" ]; then
  echo "Error: New version is the same as current version"
  exit 1
fi

# ワーキングツリーが汚れていないか確認（--release 時のみ）
if [ "$DO_RELEASE" = "--release" ]; then
  if ! git diff --quiet HEAD 2>/dev/null; then
    echo "Error: Working tree has uncommitted changes. Commit or stash them first."
    exit 1
  fi
fi

# 1. manifest.json
sed -i "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" manifest.json
echo "Updated manifest.json"

# 2. README.md
sed -i "s/\*\*Version: $CURRENT_VERSION\*\*/\*\*Version: $NEW_VERSION\*\*/" README.md
echo "Updated README.md"

# 3. CHANGELOG.md にテンプレートを挿入
TODAY=$(date +%Y-%m-%d)
CHANGELOG="CHANGELOG.md"

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

# --release フラグがなければここで終了
if [ "$DO_RELEASE" != "--release" ]; then
  echo ""
  echo "Next steps:"
  echo "  1. Edit CHANGELOG.md with release details"
  echo "  2. $0 $NEW_VERSION --release"
  exit 0
fi

# CHANGELOG にテンプレートのままの空セクションがないか確認
CHANGELOG_SECTION=$(awk "/^## \[$NEW_VERSION\]/{found=1; next} /^## \[/{if(found) exit} found{print}" "$CHANGELOG" | grep -v '^$' | grep -v '^### ')
if [ -z "$CHANGELOG_SECTION" ]; then
  echo ""
  echo "Error: CHANGELOG.md entry for $NEW_VERSION has no content."
  echo "Please fill in the release details first, then re-run with --release."
  exit 1
fi

# コミット・タグ・push
echo ""
echo "Committing and tagging..."
git add manifest.json README.md CHANGELOG.md
git commit -m "Release v$NEW_VERSION"
git tag "v$NEW_VERSION"

echo "Pushing to remote..."
git push origin main --tags

echo ""
echo "Done! Release v$NEW_VERSION pushed."
echo "GitHub Actions will automatically create the Release from CHANGELOG.md."
