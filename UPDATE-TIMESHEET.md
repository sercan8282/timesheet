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

- **502 Bad Gateway na update**: Dit gebeurt wanneer Nginx probeert te verbinden terwijl de app nog aan het opstarten is. Het nieuwe update-script wacht nu tot de app volledig online is. Als je nog steeds 502 ziet:

```bash
# Check PM2 status en logs
pm2 status timesheet
pm2 logs timesheet --lines 100

# Check of app luistert op poort 3000
ss -ltn | grep 3000 || netstat -ltn | grep 3000

# Check Nginx upstream configuratie
sudo nginx -t
sudo tail -n 100 /var/log/nginx/error.log

# Handmatig herstarten met wachttijd
pm2 delete timesheet
pm2 start npm --name timesheet -- start
sleep 10
curl http://localhost:3000/api/health
```

- **App crasht direct na start**: Check de logs voor specifieke errors:

```bash
pm2 logs timesheet --lines 200
# Kijk naar:
# - Poortconflicten (EADDRINUSE)
# - Database errors (SQLITE_CANTOPEN, SQLITE_CORRUPT)
# - Missing environment variables (.env errors)
# - Node version mismatches
```

- **Poortconflict (EADDRINUSE)**: Meerdere app-instances draaien. Los op met één instance:

```bash
# Find en kill alle node processen op poort 3000
sudo fuser -k 3000/tcp || sudo lsof -ti:3000 | xargs kill -9
pm2 delete timesheet
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

Het nieuwe update-script lost dit automatisch op door:
- Altijd een **fresh start** te doen (delete + start in plaats van restart)
- Te **wachten tot PM2 status "online" is** (max 30 seconden)
- Te **wachten tot health endpoint reageert** (max 30 seconden)
- **Gedetailleerde logs** te tonen bij failures

Als het nog steeds faalt, diagnoseer het zo:
```bash
# 1) Check PM2 status en logs
pm2 status timesheet
pm2 logs timesheet --lines 200

# 2) Controleer of PM2 in PATH staat
which pm2 || echo "pm2 niet gevonden in PATH"
echo "$PATH"

# 3) Check de .env file
head -n 20 .env

# 4) Test handmatig starten
cd /var/www/timesheet  # pas aan naar jouw pad
NODE_ENV=production PORT=3000 node server.js
# Als dit faalt, zie je de exacte foutmelding

# 5) Check database permissions
ls -la database.sqlite
# Owner moet dezelfde user zijn als PM2 (bijv. www-data of je eigen user)
```

Handmatige fix als automated script faalt:
```bash
# Stop alles en start schoon
pm2 delete timesheet
pm2 kill
rm -f ~/.pm2/dump.pm2

# Laad nvm (indien gebruikt)
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"

# Start fresh
pm2 start npm --name timesheet -- start
pm2 save

# Wacht en check
sleep 10
pm2 status timesheet
curl http://localhost:3000/api/health
```

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
