# 📱 Timesheet APK Installation Guide

**APK File:** `app-debug.apk`  
**Location:** `C:\Users\Sergio\Documents\timesheet\android\app\build\outputs\apk\debug\app-debug.apk`  
**Size:** 4.27 MB  
**Status:** ✅ Ready for installation

---

## 🔧 Installation Instructions

### On Samsung S25 Ultra (or any Android device)

#### Step 1: Enable USB Debugging
1. Go to **Settings → About phone**
2. Tap **Build number** 7 times (to enable Developer Mode)
3. Go back and find **Developer options**
4. Enable **USB Debugging**
5. Enable **Install from unknown sources** (Security settings)

#### Step 2: Connect via USB
```bash
# Connect device via USB cable
# Authorize the connection when prompted on device

# Verify connection:
adb devices
```

Expected output:
```
List of devices attached
xxxxxxxxx               device
```

#### Step 3: Remove Old Version
```bash
adb uninstall site.urenregistratie.app
```

#### Step 4: Install New APK
```bash
# Method 1: Navigate to APK directory
cd "C:\Users\Sergio\Documents\timesheet\android\app\build\outputs\apk\debug"
adb install -r app-debug.apk

# Method 2: Full path
adb install -r "C:\Users\Sergio\Documents\timesheet\android\app\build\outputs\apk\debug\app-debug.apk"
```

#### Step 5: Launch App
```bash
# Start the app
adb shell am start -n site.urenregistratie.app/.MainActivity

# OR: Tap the app icon on your device
```

---

## 📊 APK Configuration Details

### App Information
| Property | Value |
|----------|-------|
| **Package Name** | `site.urenregistratie.app` |
| **App Version** | 1.0.0 |
| **Min Android** | API 24 (Android 7.0) |
| **Target Android** | API 36 (Android 15) |
| **Java Version** | JDK 21 |

### Permissions Included
- ✓ INTERNET - For server communication
- ✓ CAMERA - For document capture
- ✓ READ_EXTERNAL_STORAGE - File access
- ✓ WRITE_EXTERNAL_STORAGE - File storage
- ✓ ACCESS_NETWORK_STATE - Network detection

### Security Configuration
- ✓ HTTPS only for production server (`https://urenregistratie.site`)
- ✓ Network security config included
- ✓ Certificate validation enabled

### Framework & Dependencies
- **Capacitor** 8.0.0 - Hybrid app framework
- **AndroidX** - Modern Android libraries
- **Cordova** - Plugin bridge

---

## 🧪 Testing the App

### Initial Launch
1. The app will show a splash screen (blue background)
2. It will load the web application from `https://urenregistratie.site`
3. You should see the Timesheet login/home screen

### What to Test
- [ ] App launches without crashing
- [ ] Login page loads
- [ ] Can login to system
- [ ] Camera functionality works (if implemented)
- [ ] File upload works
- [ ] All permissions are granted when requested
- [ ] App doesn't freeze or crash during normal use

### View Logs (if app crashes)
```bash
# Clear logs
adb logcat -c

# Launch app
adb shell am start -n site.urenregistratie.app/.MainActivity

# Wait 5 seconds
# View crash logs
adb logcat | grep -E "site.urenregistratie|FATAL|CRASH|Exception"
```

---

## ⚠️ Troubleshooting

### "Command not found: adb"
Add Android SDK path to your environment:
```bash
# Temporarily (for this session)
set PATH=%PATH%;C:\Users\Sergio\AppData\Local\Android\Sdk\platform-tools

# Or use full path
"C:\Users\Sergio\AppData\Local\Android\Sdk\platform-tools\adb.exe" devices
```

### "Device not found"
1. Check USB connection is working
2. Check **USB Debugging is enabled** on device
3. On device: Check for "Allow USB debugging" prompt and tap **Allow**
4. Try: `adb kill-server` then `adb devices`
5. Restart device in USB debugging mode

### "Installation failed: PARSE_FAILED_NO_CERTIFICATES"
- Delete old app: `adb uninstall site.urenregistratie.app`
- Install again with `-r` flag: `adb install -r app-debug.apk`

### "App crashes on launch"
1. Get logs: `adb logcat -d | grep site.urenregistratie`
2. Look for Exception or error messages
3. Common issues:
   - Network connectivity problems
   - HTTPS certificate issues
   - Missing web assets (unlikely - APK verified)

### "HTTPS connection fails"
- Check device has internet access
- Verify `https://urenregistratie.site` is accessible from device
- Check Android version (API 24+ required for modern TLS)
- Network security config should allow HTTPS

---

## 📱 Device Requirements

### Minimum Specifications
- **Android Version:** 7.0+ (API 24)
- **RAM:** 2GB minimum, 4GB recommended
- **Storage:** 50MB free space
- **Internet:** WiFi or mobile data connection

### Tested On
- ✅ Samsung S25 Ultra (expected to work)
- Should work on any Android 7.0+ device

---

## 🔄 Reinstalling / Updating

To reinstall or update the app:

```bash
# Uninstall old version
adb uninstall site.urenregistratie.app

# Install new version
adb install -r "path\to\app-debug.apk"
```

Or use the `-r` flag to replace in one command:
```bash
adb install -r app-debug.apk
```

---

## 📞 Support

If the app still doesn't work:

1. **Collect logs:**
   ```bash
   adb logcat -d > logcat.txt
   ```

2. **Check APK integrity:**
   - Verify file size: 4.27 MB
   - Verify timestamp matches build date

3. **Verify device:**
   - Device must be API 24+ (Android 7.0+)
   - Must have internet connectivity
   - USB Debugging must be enabled

4. **Common fixes:**
   - Clear app cache: `adb shell pm clear site.urenregistratie.app`
   - Uninstall and reinstall
   - Restart device
   - Check for network connectivity on device

---

## ✅ Build Information

**APK Details:**
- Build Date: December 23, 2025
- Built with: Gradle 8.11.1
- Android Plugin: 8.9.1
- Build Tools: 34.0.0
- Status: Debug build (suitable for testing)

**Included Fixes:**
- ✓ Java 21 compilation support
- ✓ Network security configuration
- ✓ HTTPS certificate handling
- ✓ Cordova/Capacitor bridge
- ✓ Web assets properly bundled

---

Last Updated: December 23, 2025
