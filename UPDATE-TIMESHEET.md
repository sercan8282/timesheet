# Timesheet Update Handleiding (Linux)

Deze gids beschrijft hoe je je Timesheet-installatie op een Linux-server veilig en handmatig bijwerkt vanaf de GitHub-repository.

## Overzicht

- Maakt een backup van de database
- Haalt de laatste code op uit `main`
- Installeert dependencies
- Voert een idempotente DB-init uit (voegt ontbrekende tabellen/kolommen toe)
- Herstart de applicatie (PM2)
- Controleert de gezondheid en lost veelvoorkomende problemen op

## Voorwaarden

- Git, Node.js en npm zijn geïnstalleerd.
- (Aanbevolen) PM2 is geïnstalleerd en wordt gebruikt om de app te runnen.
- Nginx reverse proxy is geconfigureerd en verwijst naar de juiste upstream-poort (meestal `3000`).
- De `.env` op de server bevat geldige waarden (PORT, NODE_ENV, SMTP, JWT, etc.).

## Pad en omgeving controleren

Zorg dat je in de juiste projectmap werkt. Voorbeeld:

```bash
cd /var/www/timesheet   # pas aan naar jouw pad
```

Controleer je `.env` (productie):

```bash
# .env
PORT=3000
NODE_ENV=production
```

Zorg dat Nginx upstream (proxy_pass) naar dezelfde poort wijst als `PORT` in `.env`.

## Backup maken (SQLite)

```bash
mkdir -p backups
cp database.sqlite backups/database-$(date +%Y%m%d-%H%M%S).sqlite
```

## Handmatige update (stap-voor-stap)

1. (Optioneel) Stop PM2 om conflicten te voorkomen:

```bash
pm2 stop timesheet || true
```

2. Haal de laatste code op en update naar `main`:

```bash
git fetch --all
git checkout main
git pull --ff-only origin main
```

3. Installeer dependencies en voer DB-init uit:

```bash
if [ -f package-lock.json ]; then npm ci; else npm install --production; fi
npm run init-db
```

4. Start/herstart de app via PM2 en sla de processlijst op:

````bash
pm2 stop timesheet || true
pm2 delete timesheet || true
pm2 start npm --name timesheet -- start
pm2 save
pm2 status

## Verifiëren (health en logs)
```bash
curl -sf http://localhost:3000/api/health || echo "App niet bereikbaar"
# Of via je domein (indien SSL/Nginx actief)
curl -sf https://urenregistratie.site/api/health || echo "App niet bereikbaar via HTTPS"

pm2 logs timesheet --lines 100
sudo tail -n 100 /var/log/nginx/error.log
sudo nginx -t
````

## Rollback (indien nodig)

- Database herstellen:

```bash
cp backups/database-YYYYmmdd-HHMMSS.sqlite database.sqlite
pm2 restart timesheet
```

- Code terugdraaien (bijv. 1 commit terug):

```bash
git reset --hard HEAD~1
pm2 restart timesheet
```

## Veelvoorkomende problemen

- **502 Bad Gateway**: App herstart of npm-installatie loopt; wacht 1–5 min en controleer daarna health en logs. Herstart zo nodig:

```bash
pm2 restart timesheet
```

- **Poortconflict (EADDRINUSE)**: Meerdere app-instances. Los op met één instance:

```bash
pm2 stop timesheet || true
pm2 delete timesheet || true
pm2 start npm --name timesheet -- start
pm2 save
```

- **PM2 onder andere gebruiker**: Gebruik dezelfde user als de PM2-systemd service (vaak `pm2-<user>`). Herstart schoon:

```bash
sudo systemctl stop pm2-<user>
pm2 kill
rm -f ~/.pm2/dump.pm2
sudo systemctl start pm2-<user>
pm2 ping
```

- **X-Forwarded-For / rate-limit fout**: `trust proxy` staat aan in de app; zorg dat Nginx correct proxy’t en upstream klopt.

### PM2 blijft op "stopped" staan (na System Update)

Dit heeft meestal één van deze oorzaken:
- **Startfout in de app**: `npm start` crasht door verkeerde `.env`, poortconflict of DB-probleem.
- **PM2 PATH/user mismatch**: De update draait onder een omgeving waar `pm2` niet in `PATH` staat of onder een andere user dan waar PM2 actief is.
- **Meerdere PM2 lijsten/processen**: PM2 draait onder verschillende users of er zijn oude processen die conflicten geven.

Zo diagnoseer je het snel:
```bash
pm2 status timesheet
pm2 logs timesheet --lines 200
which pm2 || echo "pm2 niet gevonden in PATH"
echo "$PATH"; echo "PM2_HOME=${PM2_HOME:-unset}"; whoami
curl -sf http://localhost:3000/api/health || echo "Health endpoint faalt"
```

Zo los je het op:
```bash
# 1) Zorg dat er maar één instance is en start schoon
pm2 stop timesheet || true
pm2 delete timesheet || true
pm2 start npm --name timesheet -- start
pm2 save
pm2 status timesheet

# 2) Als pm2 niet gevonden wordt, laad nvm (indien gebruikt) en probeer opnieuw
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" && hash pm2 2>/dev/null && echo "nvm geladen"
pm2 start npm --name timesheet -- start || echo "PM2 start faalde"
pm2 save

# 3) Controleer de app-logs en pas .env aan
pm2 logs timesheet --lines 200
sed -n '1,120p' .env || true

# 4) Check poort en Nginx upstream
ss -ltn | grep 3000 || echo "Niets luistert op 3000"
sudo nginx -t; sudo tail -n 100 /var/log/nginx/error.log
```

Tip: zet een vaste PM2-config met `ecosystem.config.js` (zie hieronder) en beheer PM2 onder één user (dezelfde als production). Dit voorkomt PATH/user issues.

## Menu-item "System Update" toevoegen (eenmalig)

Het UI-menu komt uit de database. Na een code-update blijft je eigen navigatie intact. Voeg het menu-item zo toe:

```bash
# Via helper-script (aanbevolen)
node scripts/add-system-update-menu.js

# Of direct SQL
sqlite3 database.sqlite "INSERT OR REPLACE INTO ui_menu (page_key,label,sort_order,visible) VALUES ('system-update','System Update',99,1);"
sqlite3 database.sqlite "INSERT OR REPLACE INTO translations (namespace,key,locale,text) VALUES ('menu','system-update','en','System Update');"
sqlite3 database.sqlite "INSERT OR REPLACE INTO translations (namespace,key,locale,text) VALUES ('menu','system-update','nl','Systeemupdate');"
```

Herstart daarna de app en ververs je browser.

## Tip: Ecosystem file voor stabiele PM2-config

Maak `ecosystem.config.js` aan om env en script vast te leggen:

```javascript
module.exports = {
  apps: [
    {
      name: "timesheet",
      script: "server.js",
      instances: 1,
      env: { NODE_ENV: "production", PORT: 3000 },
    },
  ],
};
```

Start en bewaar:

```bash
pm2 delete timesheet || true
pm2 start ecosystem.config.js --only timesheet
pm2 save
pm2 status
```

## Alternatief: Updaten via Admin UI

Via **Admin → System Update** start je dezelfde stappen als hierboven. Tijdens de update kan tijdelijk een 502 optreden totdat de app herstart is.

---

Vragen of maatwerk nodig (branch, vaste PM2-naam, extra checks)? Laat het weten; ik pas het script en deze instructies aan jouw omgeving aan.
