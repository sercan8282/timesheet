# Deploy op Linux (Nginx + systemd + HTTPS)

## Vereisten
- Linux host met sudo-toegang
- Node.js 18+ en npm (bijv. via NodeSource)
- git, sqlite3
- Nginx
- Certbot (Let's Encrypt) voor HTTPS

## Code en install
```bash
git clone https://github.com/<jouw-repo>/timesheet.git
cd timesheet
npm install
```

## Environment
Maak `.env` (of exporteer vars) met bijvoorbeeld:
```
PORT=3000
DB_PATH=/var/lib/timesheet/database.sqlite
JWT_SECRET=<sterke-secret>
```
Zorg dat de DB-map bestaat en schrijfbaar is door de service user.

## Database initialiseren
```bash
npm run init-db
```

## systemd service
Maak `/etc/systemd/system/timesheet.service`:
```
[Unit]
Description=Timesheet app
After=network.target

[Service]
WorkingDirectory=/opt/timesheet
ExecStart=/usr/bin/node server.js
Restart=always
Environment=PORT=3000
Environment=DB_PATH=/var/lib/timesheet/database.sqlite
Environment=JWT_SECRET=<sterke-secret>
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
```
Activeer:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now timesheet
sudo systemctl status timesheet
```

## Nginx reverse proxy + HTTPS
Certificaat ophalen:
```bash
sudo certbot --nginx -d uren.eutransport.nl
```
Nginx-config `/etc/nginx/sites-available/uren.eutransport.nl`:
```
server {
  listen 80;
  server_name uren.eutransport.nl;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name uren.eutransport.nl;

  ssl_certificate /etc/letsencrypt/live/uren.eutransport.nl/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/uren.eutransport.nl/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```
Enable en reload:
```bash
sudo ln -s /etc/nginx/sites-available/uren.eutransport.nl /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## Updates
```bash
cd /opt/timesheet
git pull
npm install
sudo systemctl restart timesheet
```

## Logs en cert renew
- Logs: `journalctl -u timesheet -f`
- Cert renew check: `sudo certbot renew --dry-run`

## Checklist
- [ ] .env gevuld (PORT/DB_PATH/JWT_SECRET)
- [ ] DB-map bestaat en rechten ok
- [ ] `npm run init-db` uitgevoerd
- [ ] systemd actief (`systemctl status timesheet`)
- [ ] Nginx proxy live op https://uren.eutransport.nl
- [ ] Certbot renew werkt
