#!/bin/sh
# Fix readlink call in Pods framework script for CI archive builds
# Execute from ios/App/ directory (called via ../../scripts/ios-archive-fix.sh)
TARGET='Pods/Target Support Files/Pods-App/Pods-App-frameworks.sh'
if [ -f "$TARGET" ]; then
  sed -i.bak 's/source="$(readlink "${source}")"/source="$(readlink -f "${source}")"/' "$TARGET" && rm -f "$TARGET.bak"
fi
