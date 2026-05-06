#!/usr/bin/env python3
import sys
import plistlib

def add_uri_scheme(plist_path):
    """Add cairn:// URI scheme to Info.plist"""
    try:
        with open(plist_path, 'rb') as f:
            plist = plistlib.load(f)
        
        # Add URL scheme handler
        plist['CFBundleURLTypes'] = [
            {
                'CFBundleURLName': 'cairn',
                'CFBundleURLSchemes': ['cairn']
            }
        ]

        # Hide Dock icon at launch (equivalent to ActivationPolicy::Accessory,
        # but set before any window is created — avoids resetting window flags)
        plist['LSUIElement'] = True
        
        with open(plist_path, 'wb') as f:
            plistlib.dump(plist, f)
        
        print(f"✓ Added cairn:// URI scheme to {plist_path}")
        return True
    except Exception as e:
        print(f"✗ Error modifying {plist_path}: {e}", file=sys.stderr)
        return False

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: add-uri-scheme.py <path-to-info.plist>")
        sys.exit(1)
    
    success = add_uri_scheme(sys.argv[1])
    sys.exit(0 if success else 1)
