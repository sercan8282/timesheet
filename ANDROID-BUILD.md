# Sessie 2: Android Project Configuratie

## ✅ Wat is klaar:
- Capacitor config bijgewerkt naar productie URL: `https://urenregistratie.site`
- App ID ingesteld: `site.urenregistratie.app`
- CORS uitgebreid voor productie domein
- Android splash screen configuratie
- Android security settings (geen mixed content)

## 🚀 Volgende Stappen:

### 1. Capacitor Installeren
```powershell
npm run mobile:setup
```
Dit installeert:
- @capacitor/core
- @capacitor/cli
- @capacitor/android
- @capacitor/ios

### 2. Capacitor Initialiseren
```powershell
npx cap init
```
**Antwoorden:**
- App name: `Timesheet`
- App package ID: `site.urenregistratie.app`
- Web asset directory: `public`

### 3. Android Platform Toevoegen
```powershell
npm run cap:add:android
```

### 4. Android Permissions Instellen
Na stap 3 wordt het bestand `android/app/src/main/AndroidManifest.xml` aangemaakt.
Voeg deze permissions toe:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
```

### 5. Web Assets Synchroniseren
```powershell
npm run cap:sync
```

### 6. Android Studio Openen
```powershell
npm run cap:open:android
```

### 7. Test Build in Android Studio
1. Klik op **Build → Build Bundle(s) / APK(s) → Build APK(s)**
2. Wacht tot build compleet is
3. APK vind je in: `android/app/build/outputs/apk/debug/app-debug.apk`

### 8. Testen op Apparaat
- Installeer APK op Android telefoon
- Of gebruik Android Studio emulator

## 📝 Belangrijke Notities:

### URL Configuratie
- **Huidige URL:** `https://urenregistratie.site`
- **Wanneer URL verandert:** Update `capacitor.config.json` → regel 6 → `server.url`
- Na URL wijziging: `npm run cap:sync`

### App ID Format
- Moet omgekeerde domein notatie zijn: `site.urenregistratie.app`
- **LET OP:** Kan NIET meer veranderd worden na Play Store publicatie!

### HTTPS Vereisten
- Productie server MOET HTTPS hebben
- HTTP werkt alleen voor localhost development
- `cleartext: false` forceert HTTPS verbinding

### Development vs Productie
**Development (localhost):**
```json
"server": {
  "url": "http://localhost:3000",
  "cleartext": true,
  "androidScheme": "http"
}
```

**Productie (huidige config):**
```json
"server": {
  "url": "https://urenregistratie.site",
  "cleartext": false,
  "androidScheme": "https"
}
```

## ⚠️ Veelvoorkomende Problemen:

### "Could not find or load main class"
- Zorg dat Java JDK 17 geïnstalleerd is
- Stel JAVA_HOME environment variable in

### "SDK location not found"
- Installeer Android Studio
- Maak `android/local.properties` aan:
  ```
  sdk.dir=C:\\Users\\Administrator\\AppData\\Local\\Android\\Sdk
  ```

### "Cleartext HTTP traffic not permitted"
- Voor productie: gebruik HTTPS
- Voor localhost: zet `cleartext: true`

### CORS errors in app
- Controleer of `https://urenregistratie.site` in CORS origins staat (server.js)
- Herstart server na CORS wijziging

## 🎯 Na URL Wijziging:

Als de URL later verandert (bv. naar `https://nieuwe-url.nl`):

1. **Update capacitor.config.json:**
   ```json
   "server": {
     "url": "https://nieuwe-url.nl",
     "cleartext": false,
     "androidScheme": "https"
   }
   ```

2. **Update CORS in server.js:**
   ```javascript
   origin: [
     'http://localhost:3000',
     'https://nieuwe-url.nl',  // ← nieuwe URL
     'capacitor://localhost',
     // ...
   ]
   ```

3. **Sync en rebuild:**
   ```powershell
   npm run cap:sync
   npm run build:android
   ```

## 📦 Volgende Sessie:
- Code signing voor release build
- Play Store voorbereiden
- APK optimaliseren
- Icon set completeren
