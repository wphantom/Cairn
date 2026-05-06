#!/usr/bin/env python3
"""
Add custom URI scheme (cairn://) to macOS app Info.plist
"""
import sys
import plistlib
from pathlib import Path

def add_uri_scheme(app_path):
    """Add cairn:// URI scheme to the Info.plist"""
    info_plist = Path(app_path) / "Contents" / "Info.plist"
    
    if not info_plist.exists():
        print(f"Error: Info.plist not found at {info_plist}")
        sys.exit(1)
    
    with open(info_plist, 'rb') as f:
        plist = plistlib.load(f)
    
    # Add CFBundleURLTypes for cairn:// scheme
    plist['CFBundleURLTypes'] = [
        {
            'CFBundleURLName': 'Cairn URL Scheme',
            'CFBundleURLSchemes': ['cairn'],
        }
    ]
    
    with open(info_plist, 'wb') as f:
        plistlib.dump(plist, f)
    
    print(f"✓ Added cairn:// URI scheme to {info_plist}")

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <path_to_app>")
        sys.exit(1)
    
    add_uri_scheme(sys.argv[1])
