# Capacitor Mobile App Setup

## STAP 1: Installeer Capacitor Dependencies

Voer dit commando uit in je terminal (PowerShell):

```powershell
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
```

## STAP 2: Initialiseer Capacitor

```powershell
npx cap init
```

Je wordt gevraagd:
- **App name:** `Timesheet`
- **App ID:** `nl.jouwbedrijf.timesheet` (vervang jouwbedrijf door je echte bedrijfsnaam, bijv. `nl.transportbv.timesheet`)
- **Web asset directory:** `public`

## STAP 3: Platform Toevoegen

### Voor Android:
```powershell
npx cap add android
```

### Voor iOS (alleen als je een Mac hebt):
```powershell
npx cap add ios
```

## STAP 4: Sync Project

```powershell
npx cap sync
```

## BELANGRIJK:
Na deze stappen heb je:
- ✅ `capacitor.config.json` (wordt automatisch aangemaakt)
- ✅ `android/` folder (Android project)
- ✅ `ios/` folder (iOS project - alleen op Mac)

## VERVOLG:
Ik zal daarna:
1. `capacitor.config.json` aanpassen met jouw server URL
2. CORS in server.js fixen
3. Build scripts toevoegen

## Problemen?
- **"npx not found"**: Zorg dat Node.js geïnstalleerd is
- **Poort 3000 in gebruik**: Stop eerst je server (`npm start`)
- **Permission denied**: Run PowerShell als Administrator
