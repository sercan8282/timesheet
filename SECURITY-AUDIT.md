# Security Audit Report - Timesheet Application

**Datum:** 22 december 2025  
**Gevraagd door:** Administrator

## Samenvatting

De Timesheet-applicatie is gecontroleerd op veelvoorkomende beveiligingsrisico's. Hieronder volgt een gedetailleerd overzicht van de bevindingen.

---

## 1. ✅ Authenticatie & Autorisatie

### Status: **GOED**

**Bevindingen:**
- **JWT-gebaseerde authenticatie** met correcte verificatie via `authMiddleware`
- **Role-based access control (RBAC)**: Admin-routes worden beschermd door `adminMiddleware`
- **User isolation**: Queries gebruiken `req.user.id` om data te beperken tot de ingelogde gebruiker
  - Voorbeeld: `SELECT * FROM timesheets WHERE user_id = ?` met `[req.user.id]`
  - Voorbeeld: `SELECT * FROM submissions WHERE id = ? AND user_id = ?`
- **MFA (Multi-Factor Authentication)** is geïmplementeerd met Speakeasy/TOTP
- **Account blocking**: Geblokkeerde gebruikers kunnen niet inloggen (`is_blocked` check)

**Conclusie:** Een gebruiker kan **GEEN** gegevens van andere gebruikers zien. Alle queries filteren strikt op `user_id = req.user.id`.

---

## 2. ✅ SQL Injection Bescherming

### Status: **GOED**

**Bevindingen:**
- **Parameterized queries** worden consequent gebruikt in alle routes
- Geen string concatenatie in SQL queries gevonden
- Database-library: `sqlite3` met prepared statements
- Voorbeelden van veilige queries:
  ```javascript
  db.get("SELECT * FROM users WHERE id = ?", [req.user.id])
  db.all("SELECT * FROM timesheets WHERE id IN (${placeholders}) AND user_id = ?", 
         [...timesheetIds, req.user.id])
  ```

**Geen risico's gevonden voor SQL injection.**

---

## 3. ✅ Password Security

### Status: **GOED**

**Bevindingen:**
- **Bcrypt hashing** met salt rounds (bcryptjs library)
- Wachtwoorden worden **NOOIT** in plaintext opgeslagen
- Hash-voorbeelden:
  ```javascript
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  const isValid = await bcrypt.compare(currentPassword, user.password);
  ```
- Wachtwoord requirements: Minimum 6 karakters (zou verhoogd kunnen worden naar 8+)

**Aanbeveling:** Verhoog minimum wachtwoordlengte naar 8-12 karakters en voeg complexity requirements toe (hoofdletters, cijfers, speciale tekens).

---

## 4. ⚠️ XSS (Cross-Site Scripting) Risico

### Status: **MATIG RISICO**

**Bevindingen:**
- **Frontend gebruikt template literals** met `innerHTML` assignments
- Veel user input wordt direct in HTML geïnjecteerd zonder escape
- Voorbeelden van risico's:
  ```javascript
  metaDiv.innerHTML = `Toon ${start}-${end} van ${data.pagination.total}`;
  alertDiv.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
  container.innerHTML = `<div class="p-3 text-danger small">Kon PDF niet laden (${err.message})</div>`;
  ```
- **Content Security Policy (CSP) is uitgeschakeld** in server.js:
  ```javascript
  helmet({ contentSecurityPolicy: false })
  ```

**Aanbevelingen:**
1. **Escape user input** bij rendering in HTML
2. **Activeer CSP** met strict policy
3. Gebruik `textContent` in plaats van `innerHTML` waar mogelijk
4. Implementeer input sanitization library (bijv. DOMPurify)

**Urgentie:** Medium - risico bestaat vooral als malicious data in database komt via andere kwetsbaarheden.

---

## 5. ✅ Session/JWT Security

### Status: **GOED met aanbevelingen**

**Bevindingen:**
- **JWT Secret** is sterk (128+ karakters random string in .env)
- **Token expiratie**: 24 uur (configureerbaar via `JWT_EXPIRES_IN`)
- Token wordt correct geverifieerd bij elke request
- Token storage: Bearer token in Authorization header + fallback naar query parameter voor SSE

**Aanbevelingen:**
1. **Verwijder .env uit Git** (staat nu in repository - bevat SMTP credentials!)
2. Voeg `.env` toe aan `.gitignore` en gebruik `.env.example` als template
3. Implementeer token refresh mechanism voor langere sessies
4. Overweeg kortere expiration (bijv. 1 uur) met refresh tokens

**URGENT:** ⚠️ **SMTP credentials staan in .env file en zijn zichtbaar in de repository!**

---

## 6. ⚠️ Input Validation

### Status: **GOED maar inconsistent**

**Bevindingen:**
- **Express-validator** wordt gebruikt voor API input validation
- Voorbeelden van validatie:
  ```javascript
  body("username").trim().notEmpty().withMessage("Username is required")
  body("newPassword").isLength({ min: 6 })
  ```
- **Inconsistentie**: Niet alle endpoints hebben even strikte validatie

**Aanbevelingen:**
1. Voeg validatie toe aan alle user input endpoints
2. Valideer ook query parameters en URL parameters
3. Implementeer max length checks om buffer overflow te voorkomen

---

## 7. ✅ Rate Limiting

### Status: **GOED**

**Bevindingen:**
- Express-rate-limit geïmplementeerd
- Limieten: 1000 requests per 5 minuten per IP
- Static files worden uitgesloten van rate limiting
- Trust proxy correct geconfigureerd voor Nginx

**Aanbeveling:** Voor productie, overweeg Redis-backed store voor gedistribueerde rate limiting.

---

## 8. ⚠️ Credentials in Repository

### Status: **KRITIEK RISICO**

**Bevindingen:**
- **.env file staat in Git repository** met:
  - SMTP credentials (username: `info@eutransport.nl`, password: `AdemAyliz2023!`)
  - JWT_SECRET (moet geheim blijven)
  - Admin default password (`Admin@123456`)

**URGENTE ACTIES:**
1. **Verwijder .env onmiddellijk uit Git:**
   ```bash
   git rm --cached .env
   echo ".env" >> .gitignore
   git add .gitignore
   git commit -m "Remove .env from repository and add to .gitignore"
   git push
   ```

2. **Wijzig alle credentials:**
   - Nieuwe SMTP password instellen
   - Nieuwe JWT_SECRET genereren
   - Admin password wijzigen via UI

3. **Maak .env.example aan** zonder echte credentials:
   ```dotenv
   JWT_SECRET=your-secret-here
   SMTP_USER=your-email@domain.com
   SMTP_PASS=your-password-here
   ```

---

## 9. ✅ HTTPS/SSL

### Status: **GOED (indien geconfigureerd)**

**Bevindingen:**
- App draait achter Nginx reverse proxy
- SSL/HTTPS configuratie is verantwoordelijkheid van Nginx
- Trust proxy correct ingesteld

**Aanbeveling:** Verifieer dat Nginx SSL configuratie up-to-date is (TLS 1.2+, sterke ciphers).

---

## 10. ⚠️ File Upload Security

### Status: **RISICO**

**Bevindingen:**
- Multer gebruikt voor file uploads (invoices, translations)
- Bestandstype validatie aanwezig maar beperkt
- Upload directory: `public/uploads/` (direct accessible)

**Aanbevelingen:**
1. Implementeer strikte MIME type checks
2. Scan uploaded files op malware
3. Genereer random filenames om directory traversal te voorkomen
4. Overweeg uploads buiten `public/` directory te plaatsen

---

## Prioriteiten & Actieplan

### 🔴 URGENT (Direct oplossen)
1. **Verwijder .env uit Git en wijzig alle credentials**
2. **Activeer Content Security Policy**

### 🟡 MEDIUM (Binnen 1-2 weken)
1. **Implementeer XSS escaping** in frontend
2. **Verhoog wachtwoord requirements** (min 8 chars, complexity)
3. **Voeg strikte input validation** toe aan alle endpoints
4. **Verbeter file upload security**

### 🟢 LOW (Bij volgende update)
1. Implementeer token refresh mechanism
2. Redis-backed rate limiting voor productie
3. Voeg security headers toe (X-Frame-Options, etc.)
4. Implementeer audit logging voor admin acties

---

## Conclusie

**Overall Security Rating: 7/10**

De applicatie heeft een **sterke basis** met goede authenticatie, SQL injection bescherming en password security. De grootste risico's zijn:
1. **Credentials in Git repository** (KRITIEK)
2. **XSS kwetsbaarheid** door onveilige innerHTML gebruik (MEDIUM)
3. **CSP uitgeschakeld** (MEDIUM)

Na het oplossen van de urgente punten stijgt de rating naar **9/10**.
