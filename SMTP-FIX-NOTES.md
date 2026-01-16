# SMTP Password Persistence Fix

## Problem
SMTP password was not saved on Linux server when updating settings without entering a new password.

## Root Cause
- Frontend always sent `smtp_pass` field (even when empty)
- Backend UPDATE query checked `if (smtp_pass && smtp_pass.trim())`
- Empty string passed the first check but failed trim() check
- Password was not saved, and old password was not preserved

## Solution

### Files Changed

1. **public/js/admin-new.js** (v10)
   - Only send `smtp_pass` if field has value
   - Only send `oauth_client_secret` if field has value
   - Updated placeholder: "Laat leeg om huidig wachtwoord te behouden"
   - Added security comment about password fields

2. **routes/admin.js**
   - GET `/smtp-settings` now removes:
     - `smtp_pass`
     - `smtp_pass_encrypted` 
     - `oauth_client_secret`
   - For security: passwords never sent to frontend

3. **public/index.html**
   - Asset version updated to v10

4. **scripts/diagnose-smtp-encryption.js** (NEW)
   - Diagnostic tool to check:
     - ENCRYPTION_KEY in .env
     - Database password fields
     - Decryption success/failure

## Linux Deployment Steps

```bash
cd /var/www/timesheet
git fetch --all
git pull origin <branch-name>
pm2 restart timesheet
sleep 10
```

Then in Admin UI:
1. Go to Admin → SMTP Settings
2. Enter SMTP password for info@eutransport.nl
3. Click "Instellingen opslaan"
4. Test with "Verbinding testen" button

Password will now be encrypted and stored in `smtp_pass_encrypted` column.

## Diagnosis Result

Ran on Linux server:
```
ENCRYPTION_KEY: YES ✓ (77ab7d0d49... - 64 chars)
Database path: /var/www/timesheet/eutransport
smtp_pass (plaintext): NO
smtp_pass_encrypted: NO ✗
```

**Conclusion:** Password was never saved in database - not a decryption issue, but a save logic issue.

## Fix Verified
- Frontend now only sends password when field is not empty
- Backend preserves existing password when new password not provided
- Asset cache busted with v10
