# SSL/HTTPS CERTIFICAAT GIDS - Stap voor Stap

Dit document beschrijft hoe je een SSL/HTTPS certificaat installeert zodat je applicatie van buiten bereikbaar is via een veilige verbinding.

---

## WAT IS SSL/HTTPS?

### HTTP vs HTTPS

```
HTTP (onveilig):
- Data gaat in plaintext over internet
- Iedereen kan zien wat je typet (wachtwoorden!)
- Browsers waarschuwen: "Not Secure"

HTTPS (veilig):
- Data is VERSLEUTELD
- Iedereen ziet gibberish
- Browsers tonen groen slotje: "Secure"
```

### SSL vs TLS

- **SSL** = Oude naam (Secure Sockets Layer)
- **TLS** = Nieuwe naam (Transport Layer Security)
- **Dezelfde technologie**, nieuwere naam

### Certificaat

Een certificaat is zoals een "digitaal paspoort" dat bewijst:
- "Dit is ECHT de domain YOUR-DOMAIN.COM"
- "Je kunt veilig data sturen"
- "We hebben dit geverifieerd"

---

## OPTIE 1: LET'S ENCRYPT (GRATIS & AANBEVOLEN)

Let's Encrypt is een gratis certificaat provider. Perfect voor productie.

### 1.1 Vereisten

- Ubuntu server met Nginx geïnstalleerd
- Domain die je bezit (dus eigenaar bent)
- Domain pointing naar je server IP (DNS)

### 1.2 DNS Instellen (Voor je domein)

**Dit moet EERST gedaan worden!**

```bash
# Test of DNS correct is ingesteld
nslookup YOUR-DOMAIN.COM

# Of met dig
dig YOUR-DOMAIN.COM

# Je zou je server IP moeten zien:
# YOUR-DOMAIN.COM has address 123.45.67.89
```

**Hoe in te stellen (bij je domain registrar):**

1. Ga naar je domain registrar (bijv. Namecheap, GoDaddy, etc.)
2. Zoek "DNS Settings" of "DNS Management"
3. Voeg A record toe:
   ```
   Type: A
   Name: @ (of je domein)
   Value: 123.45.67.89 (je server IP)
   TTL: 3600 (standaard)
   ```
4. Wacht 5-30 minuten tot DNS update (kan langer duren)

**Test DNS:**
```bash
# Wacht tot dit je server IP toont
ping YOUR-DOMAIN.COM

# En dit:
curl http://YOUR-DOMAIN.COM
```

---

### 1.3 Certbot Installeren

```bash
# Update package lists
sudo apt update

# Installeer Certbot en Nginx plugin
sudo apt install -y certbot python3-certbot-nginx

# Controleer installatie
certbot --version

# Zou iets als "certbot 2.5.0" moeten geven
```

---

### 1.4 Certificaat Aanvragen

```bash
# STOP FIRST: Zorg dat Nginx draait
sudo systemctl status nginx

# Vraag certificaat aan (Certbot zal DNS valideren)
sudo certbot certonly --nginx -d YOUR-DOMAIN.COM -d www.YOUR-DOMAIN.COM

# Volg de prompts:
# - Voer email in (voor certificaat alerts)
# - Accepteer terms (A)
# - EFF contact (Y/N - jouw keuze)
```

**Verwachte output:**
```
Congratulations! Your certificate has been issued.
Certificate is saved at: /etc/letsencrypt/live/YOUR-DOMAIN.COM/fullchain.pem
Key is saved at: /etc/letsencrypt/live/YOUR-DOMAIN.COM/privkey.pem
Expires on: 2024-03-19 10:30 UTC

IMPORTANT NOTES:
 - Congratulations! Your certificate has been successfully renewed, and the
   new certificate is already being used.
```

---

### 1.5 Certificaat Locaties

Na succesvolle aanvraag zijn je certificaten hier:

```bash
# Controleer
ls -la /etc/letsencrypt/live/YOUR-DOMAIN.COM/

# Je zou deze files zien:
# cert.pem       - Je certificaat
# privkey.pem    - Je private key (SECRET!)
# chain.pem      - Intermediary certificaten
# fullchain.pem  - cert.pem + chain.pem (meestal wat je nodig hebt)
```

---

### 1.6 Nginx Configureren voor HTTPS

Update je Nginx config met de certificaat paden:

```bash
# Open je Nginx config
sudo nano /etc/nginx/sites-available/default
```

**Vul dit in:**

```nginx
# Redirect HTTP naar HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name YOUR-DOMAIN.COM www.YOUR-DOMAIN.COM;
    return 301 https://$server_name$request_uri;
}

# HTTPS Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name YOUR-DOMAIN.COM www.YOUR-DOMAIN.COM;

    # SSL Certificaten
    ssl_certificate /etc/letsencrypt/live/YOUR-DOMAIN.COM/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/YOUR-DOMAIN.COM/privkey.pem;

    # SSL Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logging
    access_log /var/log/nginx/timesheet_access.log;
    error_log /var/log/nginx/timesheet_error.log;

    # Proxy naar Node.js app
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Sla op: Ctrl + O, Enter, Ctrl + X**

---

### 1.7 Nginx Testen en Herstarten

```bash
# Test config voor syntax errors
sudo nginx -t

# Zou dit geven:
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful

# Herstart Nginx
sudo systemctl restart nginx

# Controleer status
sudo systemctl status nginx
```

---

### 1.8 Test HTTPS Verbinding

```bash
# Test met curl
curl -I https://YOUR-DOMAIN.COM

# Zou dit moeten geven:
# HTTP/1.1 200 OK
# Server: nginx
# Strict-Transport-Security: max-age=31536000; includeSubDomains

# Open in browser
# https://YOUR-DOMAIN.COM

# Je zou een GROEN slotje moeten zien
```

---

### 1.9 Auto-Renewal Inschakelen

Let's Encrypt certificaten gelden 90 dagen. Certbot verlengt automatisch.

```bash
# Test auto-renewal (dry run, geen verandering)
sudo certbot renew --dry-run

# Zou iets als dit geven:
# Processing /etc/letsencrypt/renewal/YOUR-DOMAIN.COM.conf
# Cert is due for renewal, auto-renewing...
# Renewal successful, new certificate deployed.

# Enable automatic renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# Controleer status
sudo systemctl status certbot.timer

# Zie renewal logs
sudo journalctl -u certbot.timer -n 10
```

**What happens:**
- Elke dag check certbot of certificaat bijna verloopt
- Na 30 dagen voor expiry, wordt het automatisch vernieuwd
- Je hoeft niets te doen!

---

### 1.10 Controleer Certificaat

```bash
# Toon alle certificaten
sudo certbot certificates

# Output:
# Found the following certs:
#   Certificate Name: YOUR-DOMAIN.COM
#     Domains: YOUR-DOMAIN.COM, www.YOUR-DOMAIN.COM
#     Expiry Date: 2024-03-19 (79 days left)
#     Certificate Path: /etc/letsencrypt/live/YOUR-DOMAIN.COM/fullchain.pem
#     Private Key Path: /etc/letsencrypt/live/YOUR-DOMAIN.COM/privkey.pem

# Controleer expiry datum
openssl x509 -enddate -noout -in /etc/letsencrypt/live/YOUR-DOMAIN.COM/cert.pem

# Output: notAfter=Mar 19 10:30:00 2024 GMT
```

---

## OPTIE 2: ZELF-ONDERTEKEND CERTIFICAAT (Alleen voor testing!)

### WAARSCHUWING: Dit is NIET voor productie!

Browsers tonen waarschuwingen. Maar goed voor lokaal testen van HTTPS.

```bash
# Maak zelf-ondertekend certificaat voor 365 dagen
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/selfigned.key \
  -out /etc/ssl/certs/selfsigned.crt \
  -subj "/C=NL/ST=Netherlands/L=Amsterdam/O=Company/CN=localhost"

# Nginx config voor self-signed:
sudo nano /etc/nginx/sites-available/default
```

```nginx
server {
    listen 443 ssl http2;
    ssl_certificate /etc/ssl/certs/selfsigned.crt;
    ssl_certificate_key /etc/ssl/private/selfsigned.key;
    # ... rest van config
}
```

```bash
# Herstart Nginx
sudo systemctl restart nginx
```

**In browser:**
- Chrome: Klik "Advanced" → "Proceed to localhost"
- Firefox: Klik "Advanced" → "Accept Risk"
- Edge: Klik "Details" → "Go on to the webpage"

---

## TROUBLESHOOTING

### Certificaat Error: "Cannot find domain"

```bash
# Controleer DNS
nslookup YOUR-DOMAIN.COM
dig YOUR-DOMAIN.COM

# Wacht langer (DNS propagation kan 24h zijn)
# Of use DigitalOcean nameservers (sneller)

# Controleer Nginx draait op 80/443
sudo netstat -tulpn | grep -E ":80|:443"

# Zou dit moeten geven:
# tcp 0 0 0.0.0.0:80 0.0.0.0:* LISTEN nginx
# tcp 0 0 0.0.0.0:443 0.0.0.0:* LISTEN nginx
```

### Firewall blokkeert poorten

```bash
# Zorg dat firewall ports toestaat
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw status

# Zou dit moeten geven:
# 80/tcp    ALLOW  Anywhere
# 443/tcp   ALLOW  Anywhere
```

### "SSL_ERROR_RX_RECORD_TOO_LONG"

Dit betekent je zit op http:// maar je server verwacht https://

```bash
# Controleer dat je config correct HTTP -> HTTPS redirect heeft

# In Nginx config:
server {
    listen 80;
    return 301 https://$server_name$request_uri;
}
```

### "Certificate not trusted"

```bash
# Check certificaat chain is correct
openssl s_client -connect YOUR-DOMAIN.COM:443

# Controleer fullchain.pem wordt gebruikt (niet cert.pem)
grep "ssl_certificate" /etc/nginx/sites-available/default
# Zou dit moeten zijn:
# ssl_certificate /etc/letsencrypt/live/YOUR-DOMAIN.COM/fullchain.pem;
```

### "Connection refused" op poort 443

```bash
# Zorg dat Nginx draait
sudo systemctl status nginx

# Controleer geen fouten in config
sudo nginx -t

# Check poort 443 in use
sudo netstat -tulpn | grep :443

# Herstart Nginx
sudo systemctl restart nginx
```

---

## CERTIFICAAT MANAGEMENT COMMANDS

```bash
# Toon alle certificaten
sudo certbot certificates

# Handmatig verlengen (force)
sudo certbot renew --force-renewal

# Dry run (test verlenging zonder te doen)
sudo certbot renew --dry-run

# Verwijder certificaat
sudo certbot delete --cert-name YOUR-DOMAIN.COM

# Toon renewal logs
sudo journalctl -u certbot.timer --all

# Test SSL config
ssl-test https://YOUR-DOMAIN.COM

# Of met openssl
openssl s_client -connect YOUR-DOMAIN.COM:443 -showcerts
```

---

## CERTIFICAAT SECURITY BEST PRACTICES

### 1. Private Key Beveiligen

```bash
# Private key mag NOOIT:
# - In git staan
# - Overal zichtbaar zijn
# - Gedeeld worden

# Zet juiste permissions
sudo chmod 600 /etc/letsencrypt/live/YOUR-DOMAIN.COM/privkey.pem

# Controleer
ls -l /etc/letsencrypt/live/YOUR-DOMAIN.COM/privkey.pem
# -r-------- Alleen root mag lezen
```

### 2. Automatic Renewal Controleren

```bash
# Zie renewal logs
sudo journalctl -u certbot.timer

# Test renewal
sudo certbot renew --dry-run

# Zorg certbot.timer aanstaat
sudo systemctl status certbot.timer
```

### 3. Extra Security Headers

In je Nginx config, voeg toe:

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

---

## SAMENVATTING - STAPPEN

| Stap | Commando |
|------|----------|
| 1 | DNS instellen (domain wijzend naar server IP) |
| 2 | `sudo apt install certbot python3-certbot-nginx` |
| 3 | `sudo certbot certonly --nginx -d YOUR-DOMAIN.COM` |
| 4 | Update Nginx config met certificaat paden |
| 5 | `sudo nginx -t` (check syntax) |
| 6 | `sudo systemctl restart nginx` |
| 7 | `curl https://YOUR-DOMAIN.COM` (test) |
| 8 | `sudo certbot renew --dry-run` (test auto-renewal) |
| 9 | `sudo systemctl enable certbot.timer` (zet auto-renewal aan) |
| 10 | Browser test: https://YOUR-DOMAIN.COM (groen slotje!) |

---

## CONTROLEER JE HTTPS SETUP

```bash
# ✓ DNS werkt
ping YOUR-DOMAIN.COM

# ✓ HTTP redirects naar HTTPS
curl -I http://YOUR-DOMAIN.COM
# Zou 301 redirect geven

# ✓ HTTPS werkt
curl -I https://YOUR-DOMAIN.COM
# HTTP/1.1 200 OK

# ✓ Certificaat is valide
openssl x509 -in /etc/letsencrypt/live/YOUR-DOMAIN.COM/cert.pem -text -noout | grep -A2 "Validity"

# ✓ Auto-renewal ingesteld
sudo certbot certificates

# ✓ Firewall staat poorten toe
sudo ufw status

# ✓ Node.js app draait
pm2 list

# ✓ Nginx draait
sudo systemctl status nginx
```

---

## LIVE CHECKLIST

Voor je publiek gaat:

- [ ] Domain gekocht en DNS ingesteld
- [ ] Let's Encrypt certificaat aangevraagd
- [ ] Nginx configured met HTTPS
- [ ] HTTP redirects naar HTTPS
- [ ] Auto-renewal ingeschakeld
- [ ] Firewall staat ports toe (80, 443)
- [ ] Node.js app draait via PM2
- [ ] Browser toont groen slotje
- [ ] Certificaat refresh in 80+ dagen

---

## NOG VRAGEN?

```bash
# Debug SSL connection
openssl s_client -connect YOUR-DOMAIN.COM:443

# Check Nginx errors
sudo tail -f /var/log/nginx/timesheet_error.log

# Check Certbot logs
sudo journalctl -u certbot -n 20

# Check system logs
sudo journalctl -xe
```

**Succes met je HTTPS setup! 🔒**
