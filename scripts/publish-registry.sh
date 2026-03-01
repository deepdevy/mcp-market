#!/bin/bash
# Publish all MCP servers to the Official MCP Registry
# Prerequisites: 
#   1. npm packages already published
#   2. mcp-publisher CLI installed
#   3. mcp-publisher login github

set -e

echo "🔍 Checking mcp-publisher..."
mcp-publisher --help > /dev/null 2>&1 || { 
  echo "❌ mcp-publisher not installed. Run:"
  echo 'curl -L "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_$(uname -s | tr "[:upper:]" "[:lower:]")_$(uname -m | sed "s/x86_64/amd64/;s/aarch64/arm64/").tar.gz" | tar xz mcp-publisher && sudo mv mcp-publisher /usr/local/bin/'
  exit 1
}

echo ""
echo "🚀 Publishing to MCP Registry..."

for dir in packages/*/; do
  # Skip core
  if [ "$(basename "$dir")" = "core" ]; then
    continue
  fi
  
  # Check for server.json
  if [ ! -f "${dir}server.json" ]; then
    echo "⏭️  Skipping $(basename "$dir") — no server.json"
    continue
  fi
  
  pkg_name=$(node -p "require('./${dir}package.json').name")
  echo "Publishing $pkg_name to MCP Registry..."
  
  cd "$dir"
  mcp-publisher publish || echo "⚠️  Failed: $pkg_name"
  cd ../..
done

echo ""
echo "✅ Done! Verify at: https://registry.modelcontextprotocol.io"
