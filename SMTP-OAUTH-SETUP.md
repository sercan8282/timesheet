# SMTP OAuth Setup Guide (Azure Entra ID)

Deze gids beschrijft hoe je SMTP OAuth2 configureert voor je Timesheet-applicatie met Azure Entra ID (voorheen Azure AD).

## Overzicht

De applicatie gebruikt **Client Credentials Flow** (app-only) om een access token te verkrijgen voor SMTP-authenticatie met Office 365 / Outlook.

## Vereisten

- Azure tenant met admin-rechten
- Office 365 mailbox voor verzenden
- Exchange admin-rechten (voor SMTP AUTH instelling)

---

## Stap 1: App Registratie in Azure Entra ID

### 1.1 Nieuwe app aanmaken

1. Ga naar [Azure Portal](https://portal.azure.com)
2. Navigeer naar **Azure Entra ID** → **App registrations**
3. Klik **New registration**
4. Vul in:
   - **Name**: `Timesheet SMTP Sender` (of eigen naam)
   - **Supported account types**: `Accounts in this organizational directory only (Single tenant)`
   - **Redirect URI**: _laat leeg_ (niet nodig voor client credentials)
5. Klik **Register**

### 1.2 Noteer belangrijke waarden

Na registratie zie je het **Overview** scherm. Noteer:

- **Application (client) ID**: bijv. `1d48ee70-0050-4138-ac35-48a63215e94f`
- **Directory (tenant) ID**: bijv. `12345678-1234-1234-1234-123456789012`

Deze waarden heb je nodig voor de SMTP-instellingen in de app.

---

## Stap 2: Client Secret Aanmaken

1. Ga naar **Certificates & secrets** (linker menu)
2. Klik **New client secret**
3. Vul in:
   - **Description**: `Timesheet SMTP Secret`
   - **Expires**: kies de gewenste verlooptijd (bijv. 24 maanden)
4. Klik **Add**

**BELANGRIJK**: Kopieer onmiddellijk de **Value** (niet de Secret ID!):

- ✅ **Value**: De lange string die begint met iets als `g-28Q~...` (dit is het echte wachtwoord)
- ❌ **Secret ID**: De korte GUID — gebruik dit NIET

Bewaar de **Value** veilig. Je kunt deze later niet meer opvragen.

---

## Stap 3: API Permissions Configureren

### 3.1 Verwijder Graph-permissies (optioneel, indien aanwezig)

Als je eerder `Mail.Send` of `User.Read.All` hebt toegevoegd voor Microsoft Graph, kun je deze verwijderen voor SMTP. Graph is niet nodig voor SMTP OAuth.

### 3.2 Voeg Office 365 Exchange Online permissie toe

1. Ga naar **API permissions** (linker menu)
2. Klik **Add a permission**
3. Selecteer **APIs my organization uses**
4. Zoek en selecteer **Office 365 Exchange Online**
5. Klik **Application permissions** (NIET Delegated permissions)
6. Vink aan:
   - `SMTP.Send` (verplicht voor SMTP verzenden)
   - `IMAP.AccessAsApp` (optioneel, alleen als je IMAP gebruikt)
   - `POP.AccessAsApp` (optioneel, alleen als je POP gebruikt)
7. Klik **Add permissions**

### 3.3 Grant Admin Consent

**CRUCIAAL**: Client Credentials Flow werkt alleen na admin consent.

1. Klik **Grant admin consent for [Your Tenant]**
2. Bevestig met **Yes**
3. Controleer dat de status **Granted for [Your Tenant]** toont met een groen vinkje

Als je geen admin bent, vraag een Global Administrator om deze stap uit te voeren.

---

## Stap 4: Mailbox Configureren in Exchange

De verzendende mailbox moet **Authenticated SMTP** hebben ingeschakeld.

### 4.1 Via Exchange Admin Center (EAC)

1. Ga naar [Exchange Admin Center](https://admin.exchange.microsoft.com)
2. Navigeer naar **Recipients** → **Mailboxes**
3. Selecteer de mailbox die je wilt gebruiken voor verzenden (bijv. `noreply@yourdomain.com`)
4. Klik **Mail flow settings** tab (of **Manage mail flow settings**)
5. Onder **Email apps** of **SMTP AUTH**, zorg dat **Authenticated SMTP** is **Enabled**
6. Klik **Save**

### 4.2 Via PowerShell (alternatief)

```powershell
# Verbind met Exchange Online
Connect-ExchangeOnline

# Schakel SMTP AUTH in voor specifieke mailbox
Set-CASMailbox -Identity "noreply@yourdomain.com" -SmtpClientAuthenticationDisabled $false

# Controleer de instelling
Get-CASMailbox -Identity "noreply@yourdomain.com" | Select-Object SmtpClientAuthenticationDisabled
```

**Verwacht resultaat**: `SmtpClientAuthenticationDisabled : False` (betekent SMTP AUTH is enabled)

---

## Stap 5: Instellingen Invoeren in Timesheet App

### 5.1 Via Admin UI

1. Log in op je Timesheet-applicatie als admin
2. Ga naar **Admin** → **SMTP Settings**
3. Selecteer **OAuth2** als authenticatietype
4. Vul in:
   - **SMTP Host**: `smtp.office365.com`
   - **SMTP Port**: `587` (STARTTLS) of `25` (indien toegestaan)
   - **SMTP User**: Het volledige e-mailadres van de verzendende mailbox (bijv. `noreply@yourdomain.com`)
   - **OAuth Tenant ID**: De Directory (tenant) ID uit Stap 1.2
   - **OAuth Client ID**: De Application (client) ID uit Stap 1.2
   - **OAuth Client Secret**: De **Value** uit Stap 2 (de lange string, NIET de Secret ID)
   - **OAuth Scope**: Laat leeg of vul in `https://outlook.office365.com/.default` (de app normaliseert dit automatisch)
5. Klik **Save**
6. Klik **Test Connection** om de configuratie te verifiëren

### 5.2 Via SQLite (handmatig, indien nodig)

```bash
sqlite3 database.sqlite
```

```sql
UPDATE smtp_settings SET
  smtp_host = 'smtp.office365.com',
  smtp_port = 587,
  smtp_user = 'noreply@yourdomain.com',
  auth_type = 'oauth2',
  oauth_tenant_id = '',
  oauth_client_id = '',
  oauth_client_secret = '',
  oauth_scope = 'https://outlook.office365.com/.default';
```

**BELANGRIJK**: Gebruik de **Value** van de client secret, NIET de Secret ID.

---

## Stap 6: Test de Configuratie

### 6.1 Via Node.js

```powershell
node -e "require('./utils/email').testSMTPConnection().then(console.log).catch(err=>{console.error(err.message);process.exit(1);})"
```

**Verwacht resultaat** (bij succes):

```
[SMTP TEST] Starting SMTP connection test...
[SMTP TEST] Using auth type: oauth2
[SMTP OAuth] Requesting token from v2 endpoint with scope: https://outlook.office365.com/.default
[SMTP OAuth] Token acquired via v2 endpoint with scope: https://outlook.office365.com/.default
[SMTP TEST] Running verify...
[SMTP TEST] Verify passed!
[SMTP TEST] Sending test email...
[SMTP TEST] Email sent successfully!
{ success: true, message: 'SMTP connection successful! Test email sent.' }
```

### 6.2 Via Admin UI

1. Ga naar **Admin** → **SMTP Settings**
2. Klik **Test Connection**
3. Controleer je inbox (de verzendende mailbox) voor de testmail

---

## Veelvoorkomende Fouten

### AADSTS1002012: Invalid scope

**Foutmelding**: `The provided value for scope [value] is not valid. Client credential flows must have a scope value with /.default suffixed`

**Oorzaak**: De scope is niet correct geformatteerd of bevat een Secret ID in plaats van een scope.

**Oplossing**:

- Zorg dat `oauth_scope` is ingesteld op `https://outlook.office365.com/.default`
- Controleer dat je de **Value** van de client secret gebruikt, NIET de Secret ID
- De app normaliseert dit automatisch sinds de laatste update

### AADSTS7000215: Invalid client secret

**Foutmelding**: `Invalid client secret provided. Ensure the secret being sent is the client secret value, not the client secret ID`

**Oorzaak**: Je hebt de Secret ID in plaats van de Secret Value gebruikt.

**Oplossing**:

1. Ga naar Entra ID → App registrations → Jouw app → Certificates & secrets
2. Maak een **nieuwe** client secret aan (oude kun je niet meer zien)
3. Kopieer de **Value** (lange string, begint bijv. met `g-28Q~...`)
4. Update `oauth_client_secret` in de SMTP-instellingen met deze nieuwe Value

### AADSTS65001: Consent required

**Foutmelding**: `The user or administrator has not consented to use the application`

**Oorzaak**: Admin consent is niet verleend voor de API permissions.

**Oplossing**:

1. Ga naar Entra ID → App registrations → Jouw app → API permissions
2. Klik **Grant admin consent for [Your Tenant]**
3. Bevestig met **Yes**
4. Controleer dat de status groen is met een vinkje

### SmtpClientAuthenticationDisabled

**Foutmelding**: SMTP AUTH fails ondanks geldige token.

**Oorzaak**: Mailbox heeft SMTP AUTH uitgeschakeld.

**Oplossing**:

1. Ga naar Exchange Admin Center → Recipients → Mailboxes
2. Selecteer de verzendende mailbox
3. **Mail flow settings** → **SMTP AUTH** → **Enable**
4. Of via PowerShell: `Set-CASMailbox -Identity "user@domain.com" -SmtpClientAuthenticationDisabled $false`

### Token endpoint mismatch

**Foutmelding**: `AADSTS70011: Invalid scope`

**Oorzaak**: Gebruik van v1 endpoint in plaats van v2, of verkeerde scope-formaat.

**Oplossing**:

- De app gebruikt automatisch het v2 endpoint: `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token`
- Scope moet zijn: `https://outlook.office365.com/.default` (voor SMTP)
- Voor Graph (indien je die route kiest): `https://graph.microsoft.com/.default`

---

## Checklist Samenvatting

- [ ] App geregistreerd in Entra ID
- [ ] Tenant ID en Client ID genoteerd
- [ ] Client Secret **Value** (niet ID) veilig opgeslagen
- [ ] API permission `Office 365 Exchange Online` → `SMTP.Send` toegevoegd
- [ ] Admin consent verleend (groen vinkje)
- [ ] Mailbox SMTP AUTH ingeschakeld in Exchange
- [ ] SMTP-instellingen in app ingevuld met correcte waarden
- [ ] Test connection succesvol

---

## Token Flow (technisch)

De applicatie voert deze stappen uit bij het verzenden van e-mail:

1. **Token Request** naar `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token`
   - Body: `client_id`, `client_secret`, `scope=https://outlook.office365.com/.default`, `grant_type=client_credentials`
2. **Token Response**: `{ access_token: "eyJ0...", expires_in: 3600 }`
3. **SMTP Connect** naar `smtp.office365.com:587` (STARTTLS)
4. **AUTH XOAUTH2** met het access token
5. **Mail verzenden** met de geauthenticeerde sessie

---

## Alternatief: Microsoft Graph API

Als je SMTP niet wilt gebruiken, kun je ook via Graph API mailen:

- **Permissions**: Microsoft Graph → Application → `Mail.Send`
- **Scope**: `https://graph.microsoft.com/.default`
- **Endpoint**: `POST https://graph.microsoft.com/v1.0/users/{userId}/sendMail`

Dit vereist andere code en geen SMTP-server, maar werkt ook met Client Credentials Flow.

---

## Ondersteuning

- [Microsoft Entra ID Docs](https://learn.microsoft.com/en-us/entra/identity/)
- [OAuth 2.0 Client Credentials](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-client-creds-grant-flow)
- [Exchange Online SMTP AUTH](https://learn.microsoft.com/en-us/exchange/clients-and-mobile-in-exchange-online/authenticated-client-smtp-submission)

Voor vragen of problemen, controleer de logs met:

```powershell
pm2 logs timesheet --lines 100
```

Of test handmatig:

```powershell
node -e "require('./utils/email').testSMTPConnection().then(console.log).catch(console.error)"
```
