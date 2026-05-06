#!/bin/bash
set -e

# Build the app
npm run tauri build

# Add URI scheme and LSUIElement to Info.plist
python3 add-uri-scheme.py src-tauri/target/release/bundle/macos/Cairn.app/Contents/Info.plist

# Install to /Applications (remove first to avoid stale plist from cp -R merge)
rm -rf /Applications/Cairn.app
cp -R src-tauri/target/release/bundle/macos/Cairn.app /Applications/Cairn.app

echo "✓ Build complete, URI scheme registered, installed to /Applications!"
