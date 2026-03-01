#!/bin/bash
# Publish all @mcp-mk packages to npm
# Prerequisites: npm login + npm org create mcp-mk

set -e

echo "🔍 Checking npm auth..."
npm whoami || { echo "❌ Not logged in. Run: npm login"; exit 1; }

echo ""
echo "📦 Building all packages..."
pnpm run build

echo ""
echo "🚀 Publishing packages..."

# Publish core first (dependency)
echo "Publishing @mcp-mk/core..."
cd packages/core
pnpm publish --access public --no-git-checks
cd ../..

# Publish all server packages
for dir in packages/*/; do
  pkg_name=$(node -p "require('./${dir}package.json').name")
  
  # Skip core (already published)
  if [ "$pkg_name" = "@mcp-mk/core" ]; then
    continue
  fi
  
  echo "Publishing $pkg_name..."
  cd "$dir"
  pnpm publish --access public --no-git-checks
  cd ../..
done

echo ""
echo "✅ All packages published!"
echo ""
echo "Verify at: https://www.npmjs.com/org/mcp-mk"
