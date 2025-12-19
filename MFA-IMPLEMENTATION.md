# MFA (Two-Factor Authentication) Implementation Guide

## Overview

This application now includes enterprise-grade Two-Factor Authentication (MFA) using Time-based One-Time Passwords (TOTP). The implementation includes:

- **QR Code-based enrollment** compatible with Google Authenticator, Microsoft Authenticator, Authy, and other standard authenticator apps
- **Soft enforcement strategy** with graceful migration for existing users
- **Backup codes** for account recovery
- **3-skip limit** for existing users before MFA becomes mandatory

## Features

### 1. TOTP (Time-based One-Time Password)

- Industry-standard 30-second time window
- 6-digit codes compatible with all major authenticator apps
- 2-step verification window for clock drift tolerance

### 2. Soft Enforcement Strategy

- **New users**: Prompted after first login, can skip 3 times before MFA becomes mandatory
- **Existing users**: Prompted on next login after MFA feature is deployed, same 3-skip limit applies
- **No breaking changes**: Users without MFA continue working until skip limit is reached
- **Required after 3 skips**: Users must set up MFA on 4th attempt to continue

### 3. Backup Codes

- 8 unique backup codes generated during MFA setup
- Each code can be used once if authenticator is unavailable
- Codes are displayed after successful MFA setup
- Users should save them in a secure location

### 4. Database Schema

The following columns are added to the `users` table:

```sql
mfa_enabled        INTEGER DEFAULT 0      -- 1 = MFA enabled, 0 = disabled
mfa_secret         TEXT                   -- Base32-encoded TOTP secret (blank if not set up)
mfa_backup_codes   TEXT                   -- JSON array of backup codes
mfa_skip_count     INTEGER DEFAULT 0      -- Number of times user skipped MFA setup
mfa_prompted_at    DATETIME               -- Timestamp of last MFA prompt
```

These columns are automatically added during server startup if they don't exist.

## Backend API Endpoints

All MFA endpoints require authentication (JWT token in Authorization header).

### POST /api/mfa/setup

Generate secret and QR code for MFA enrollment.

**Response:**

```json
{
  "success": true,
  "secret": "JBSWY3DPEBLW64TMMQ5VKMVQU4XXXXXX",
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANS..."
}
```

### POST /api/mfa/verify

Verify TOTP token and enable MFA.

**Request:**

```json
{
  "token": "123456"
}
```

**Response:**

```json
{
  "success": true,
  "message": "MFA enabled successfully",
  "backupCodes": [
    "A1B2C3D4",
    "E5F6G7H8",
    ...
  ]
}
```

### POST /api/mfa/disable

Disable MFA (requires password + current MFA token).

**Request:**

```json
{
  "password": "user_password",
  "token": "123456"
}
```

### POST /api/mfa/skip

Increment skip counter (max 3 skips).

**Response:**

```json
{
  "success": true,
  "message": "MFA setup skipped",
  "skipsRemaining": 2,
  "skipLimitReached": false
}
```

### GET /api/mfa/status

Get current MFA status for logged-in user.

**Response:**

```json
{
  "mfaEnabled": true,
  "skipCount": 0,
  "skipsRemaining": 3,
  "skipLimitReached": false,
  "setupRequired": false
}
```

### POST /api/mfa/verify-backup

Verify backup code during login.

**Request:**

```json
{
  "backupCode": "A1B2C3D4"
}
```

### GET /api/user/backup-codes

Get backup codes for MFA-enabled users.

**Response:**

```json
{
  "codes": [
    "A1B2C3D4",
    "E5F6G7H8",
    ...
  ]
}
```

## Login Flow

### Standard Login (MFA Enabled)

1. User enters username/password
2. Server validates credentials
3. If MFA is enabled:
   - Return response with `mfaRequired: true`
   - Frontend shows token input modal
   - User enters 6-digit code from authenticator app (or backup code)
4. Server verifies TOTP token or backup code
5. If valid: Generate JWT token and allow login
6. If invalid: Return error and prompt retry

### MFA Setup Prompt (Not Enabled Yet)

1. User logs in successfully
2. Server checks MFA status:
   - If `mfaSetupRequired` (skipCount >= 3): Show mandatory setup modal (no skip button)
   - If `mfaPromptRequired` (skipCount < 3): Show setup modal with skip option
3. User can either:
   - Scan QR code with authenticator app and verify token
   - Skip setup (reduces remaining skips)
4. After 3 skips, MFA setup becomes mandatory

## Frontend Pages

### Login Modal (`/js/mfa.js`)

**MFA Setup Mode:**

- Display QR code
- Show secret code for manual entry
- Verification token input
- Display 8 backup codes after successful setup

**MFA Login Mode:**

- 6-digit code input
- Backup code option
- Verification button

**Backup Code Mode:**

- 8-character backup code input
- Back to code entry option

### MFA Settings Page (`/js/mfa-settings.js`)

Accessible from user dashboard, allows users to:

- View MFA status
- Enable/disable MFA
- View backup codes
- Regenerate backup codes

## Configuration

### Environment Variables

No additional environment variables are required. The implementation uses existing JWT configuration.

### Required Dependencies

```json
{
  "speakeasy": "^2.0.0",
  "qrcode": "^1.5.4"
}
```

Both are already installed via npm.

## Security Considerations

1. **Secret Key Management:**

   - Secrets are stored in plaintext in the database
   - In production, consider encrypting sensitive data
   - Use proper database access controls

2. **Backup Codes:**

   - Should be downloaded/saved by users immediately after setup
   - Codes are marked as used when consumed
   - Create new codes by disabling and re-enabling MFA

3. **Time Sync:**

   - TOTP requires accurate system time on both server and client
   - The implementation allows ±2 time windows for tolerance
   - Ensure NTP is configured properly on production servers

4. **Clock Drift:**

   - The implementation uses a 2-step verification window
   - This allows codes from the current, previous, and next time window
   - Users should have accurate time on their authenticator device

5. **Backup Codes Recovery:**
   - Backup codes are one-time use only
   - If user loses authenticator device but saved backup codes:
     - Use any available backup code to log in
     - Code is consumed and logged
     - User can disable MFA and set up new authenticator
   - If user loses both authenticator and backup codes:
     - Contact administrator to reset MFA

## Testing

### New User Flow

1. Create new account (via admin panel or registration)
2. Log in
3. MFA prompt should appear with QR code
4. Scan QR code with authenticator app (Google Authenticator, Microsoft Authenticator, Authy, etc.)
5. Enter 6-digit code from app
6. Verify success message and backup codes display
7. Log out and log back in
8. Should be prompted for MFA token

### Skip Limit Flow

1. Log in as user without MFA enabled
2. Skip MFA setup (should show "2 skips remaining")
3. Skip again (should show "1 skip remaining")
4. Skip again (should show "0 skips remaining" - setup is now mandatory)
5. Try to log in again without setting up MFA
6. Should be forced to set up MFA (no skip button)

### Backup Code Recovery

1. Log in with enabled MFA
2. Enter wrong TOTP code (should fail)
3. Click "Use backup code instead"
4. Enter valid backup code
5. Should log in successfully
6. Backup code should be consumed (no longer available)

### Backward Compatibility

1. Existing users without MFA should log in normally
2. Should see MFA setup prompt with skip option
3. After 3 skips, MFA becomes mandatory
4. All other app features should work normally

## Admin Operations

### Resetting User MFA

To reset MFA for a user (if locked out):

```sql
UPDATE users
SET mfa_enabled = 0,
    mfa_secret = NULL,
    mfa_backup_codes = NULL,
    mfa_skip_count = 0
WHERE id = ?;
```

### Viewing MFA Status

```sql
SELECT id, username, full_name, mfa_enabled, mfa_skip_count
FROM users
WHERE mfa_enabled = 1;
```

### Exporting User MFA Configuration

```sql
SELECT id, username, mfa_enabled, mfa_skip_count, mfa_prompted_at
FROM users
ORDER BY mfa_enabled DESC;
```

## Troubleshooting

### Issue: "Invalid token" error during MFA setup

**Cause:** Clock not synchronized between server and authenticator device

**Solution:**

- Ensure system time is correct on both server and client device
- Sync phone/device time with NTP server
- The 2-step verification window should account for minor discrepancies

### Issue: User locked out after losing authenticator device

**Solution:**

- Use backup codes if available
- If no backup codes:
  1. Contact administrator
  2. Admin resets MFA: `UPDATE users SET mfa_enabled = 0, mfa_secret = NULL WHERE id = ?`
  3. User logs in and sets up new authenticator

### Issue: QR code not scanning

**Solution:**

- Ensure QR code image is visible and clear
- Use manual entry option (secret code)
- Verify authenticator app supports TOTP standard
- Try different authenticator app

### Issue: Backup codes not working

**Solution:**

- Ensure code is typed correctly (case-insensitive)
- Verify code hasn't been used already
- Generate new backup codes by:
  1. Disable MFA
  2. Re-enable MFA and generate new codes

## Migration from No-MFA to MFA

1. **Deploy MFA code** - No impact on existing users
2. **Users log in** - See MFA setup prompt with skip option
3. **Users skip 3 times** - MFA becomes mandatory on 4th login
4. **Monitor adoption** - Track % of users with MFA enabled
5. **Optional enforcement** - Can reduce skip limit or remove skips after certain date
6. **Support process** - Prepare support team for MFA reset requests

## Best Practices

1. **For Users:**

   - Save backup codes in secure location immediately after setup
   - Don't share QR code or secret code with anyone
   - Keep authenticator device secure
   - Use official authenticator apps only

2. **For Administrators:**

   - Require MFA for admin accounts immediately
   - Document MFA reset procedure
   - Monitor failed login attempts
   - Regularly audit MFA status
   - Keep backup of database with MFA data

3. **For Development:**
   - Test with multiple authenticator apps
   - Verify TOTP works with ±30 second clock drift
   - Test backup code consumption
   - Verify skip limit enforcement
   - Test backward compatibility thoroughly

## Compliance

This MFA implementation supports:

- **RFC 6238** - TOTP: Time-Based One-Time Password Algorithm
- **RFC 4648** - Base32 encoding
- **NIST SP 800-63B** - Authentication and Lifecycle Management

The implementation is suitable for:

- SOC 2 Type II compliance
- GDPR requirements (user data protection)
- ISO 27001 information security standards
- HIPAA (healthcare) security requirements

## Future Enhancements

Potential improvements for future versions:

1. **Hardware Security Keys** - Support for FIDO2/U2F devices
2. **SMS/Email OTP** - Alternative second factor
3. **Biometric Authentication** - Fingerprint/Face ID on mobile devices
4. **Device Fingerprinting** - Remember trusted devices
5. **Adaptive Authentication** - Risk-based MFA requirements
6. **Admin MFA Dashboard** - View and manage all users' MFA status
7. **Audit Logging** - Log all MFA events
8. **MFA Recovery Keys** - Longer-format recovery codes

## References

- TOTP Standard: https://tools.ietf.org/html/rfc6238
- Speakeasy Library: https://www.npmjs.com/package/speakeasy
- QRCode Library: https://www.npmjs.com/package/qrcode
- Google Authenticator: https://support.google.com/accounts/answer/1066447
- Microsoft Authenticator: https://www.microsoft.com/en-us/account/authenticator
- Authy: https://authy.com/
