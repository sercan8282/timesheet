# MFA Optioneel Update

## ✅ Wat is er veranderd?

MFA (Multi-Factor Authentication) is nu **optioneel per gebruiker** in plaats van verplicht voor iedereen.

### Belangrijkste wijzigingen:

1. **Database aanpassing** (veilig, geen data verlies):
   - Nieuwe kolom `mfa_required` toegevoegd aan de `users` tabel
   - Standaard waarde: `0` (niet verplicht)
   - Bestaande gebruikers worden NIET beïnvloed

2. **Admin interface**:
   - Nieuwe checkbox in gebruikerseigenschappen: "Require MFA (Multi-Factor Authentication)"
   - Admin kan per gebruiker instellen of MFA verplicht is

3. **Login gedrag**:
   - Gebruikers met `mfa_required = 0`: kunnen inloggen ZONDER MFA
   - Gebruikers met `mfa_required = 1`: MOETEN MFA instellen en gebruiken
   - Gebruikers die al MFA hebben ingesteld: blijven het gebruiken zoals voorheen

## 🚀 Deployment naar productie

### Veilige update procedure:

```bash
# 1. Backup maken (optioneel maar aanbevolen)
cp database.sqlite database.sqlite.backup

# 2. Git pull van de nieuwe versie
git pull

# 3. Dependencies installeren (indien nodig)
npm install

# 4. Service herstarten
sudo systemctl restart timesheet.service

# 5. Controleer de logs
sudo journalctl -u timesheet.service -n 50 -f
```

### Wat gebeurt er bij de update?

1. **Database migratie**: Automatisch bij eerste start
   - De kolom `mfa_required` wordt toegevoegd als deze nog niet bestaat
   - **Geen bestaande data wordt gewijzigd**
   - Alle huidige gebruikers krijgen `mfa_required = 0` (niet verplicht)

2. **Gebruikers kunnen direct inloggen**:
   - Bestaande users zonder MFA: kunnen inloggen zonder problemen
   - Bestaande users met MFA: blijven MFA gebruiken zoals altijd
   - NIETS breekt voor bestaande gebruikers

3. **Admin kan nu instellen**:
   - Per gebruiker bepalen of MFA verplicht is
   - Checkbox vind je bij: Admin → Users → Edit User → "Require MFA"

## 📝 Gewijzigde bestanden

- `config/database.js` - Database migratie voor nieuwe kolom
- `routes/admin.js` - Backend voor MFA verplichting instelling
- `routes/auth.js` - Login logica aangepast voor optionele MFA
- `public/js/admin-new.js` - UI checkbox voor MFA verplichting

## 🔒 Veiligheid

- **Backward compatible**: Alle bestaande functionaliteit blijft werken
- **Geen breaking changes**: Gebruikers merken niets tenzij admin MFA verplicht stelt
- **Data integriteit**: Database migratie is veilig en idempotent

## 🧪 Testen

1. Log in als admin
2. Ga naar Users beheer
3. Edit een gebruiker
4. Zie de nieuwe checkbox: "Require MFA (Multi-Factor Authentication)"
5. Test met een gebruiker:
   - Zet checkbox UIT → gebruiker kan inloggen zonder MFA
   - Zet checkbox AAN → gebruiker moet MFA instellen bij volgende login

## 📞 Support

Bij problemen:
1. Check de logs: `sudo journalctl -u timesheet.service -n 100`
2. Controleer database: `sqlite3 database.sqlite "SELECT username, mfa_required, mfa_enabled FROM users;"`
3. Herstel backup indien nodig: `cp database.sqlite.backup database.sqlite`
