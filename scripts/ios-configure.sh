#!/usr/bin/env bash
#
# Applies native iOS customizations to the CI-generated ios/ project (Info.plist).
# Runs on the macOS CI runner AFTER `npx cap add ios` / `npx cap sync ios`.
# Because ios/ is regenerated every build (it is not committed — this repo is developed on
# Windows), every native tweak must live here so builds stay reproducible.
#
# What it sets:
#   • CFBundleDisplayName            -> مطبعتي (Arabic home-screen label; bundle id stays
#                                       com.matbaaty.app from capacitor.config.ts)
#   • NSCameraUsageDescription       -> shown when a design upload opens the camera
#   • NSPhotoLibraryUsageDescription -> shown when picking a design from Photos
#   • NSPhotoLibraryAddUsageDescription -> shown when saving a design to Photos
#   • ITSAppUsesNonExemptEncryption  -> false (skips the export-compliance prompt on TestFlight;
#                                       app only uses standard HTTPS/TLS)
set -euo pipefail

PLIST="ios/App/App/Info.plist"

if [ ! -f "$PLIST" ]; then
  echo "ERROR: $PLIST not found — did 'npx cap add ios' run first?" >&2
  exit 1
fi

# Set a key to a string, adding it if it does not already exist.
set_string() {
  /usr/libexec/PlistBuddy -c "Set :$1 $2" "$PLIST" 2>/dev/null \
    || /usr/libexec/PlistBuddy -c "Add :$1 string $2" "$PLIST"
}

set_string CFBundleDisplayName "مطبعتي"
set_string NSCameraUsageDescription "نستخدم الكاميرا لالتقاط صور تصاميمك ورفعها."
set_string NSPhotoLibraryUsageDescription "نستخدم مكتبة الصور لاختيار تصاميمك ورفعها."
set_string NSPhotoLibraryAddUsageDescription "نحفظ التصاميم في مكتبة الصور عند تنزيلها."

# Export-compliance: declare we use no non-exempt encryption (standard HTTPS only).
/usr/libexec/PlistBuddy -c "Set :ITSAppUsesNonExemptEncryption false" "$PLIST" 2>/dev/null \
  || /usr/libexec/PlistBuddy -c "Add :ITSAppUsesNonExemptEncryption bool false" "$PLIST"

echo "iOS Info.plist configured:"
/usr/libexec/PlistBuddy -c "Print :CFBundleDisplayName" "$PLIST"
/usr/libexec/PlistBuddy -c "Print :ITSAppUsesNonExemptEncryption" "$PLIST"
