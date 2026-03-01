#!/bin/bash
# Publish remaining packages that were rate-limited
# Run this after npm rate limit resets (usually 1-2 hours after initial burst)

set -e

REMAINING="space sports stocks transport weather wikipedia"

echo "🔍 Checking npm auth..."
npm whoami || { echo "❌ Not logged in. Run: npm login"; exit 1; }

echo ""
echo "🚀 Publishing remaining packages..."

for pkg in $REMAINING; do
  # Check if already published
  if npm view "@mcp-mk/$pkg" version 2>/dev/null | grep -q "0.1.0"; then
    echo "⏭️  @mcp-mk/$pkg already published, skipping"
    continue
  fi
  
  echo "Publishing @mcp-mk/$pkg..."
  cd "packages/$pkg"
  pnpm publish --access public --no-git-checks 2>&1 | tail -3
  cd ../..
  
  echo "Waiting 10 seconds..."
  sleep 10
done

echo ""
echo "✅ Done! Check: https://www.npmjs.com/org/mcp-mk"
