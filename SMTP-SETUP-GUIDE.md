# SMTP Configuration Guide for Timesheet App

This guide explains how to configure email sending for your Timesheet Management System using Microsoft Exchange Online (Microsoft 365).

## Overview

The app now supports **two authentication methods**:

1. **Basic Authentication** - Simple username/password (easier setup, less secure)
2. **OAuth2 Authentication** - Recommended for production (more secure, no password storage)

## Method 1: Basic Authentication (Simple)

### Best For:
- Quick setup/testing
- Environments where OAuth is not available

### Setup Steps:

1. **Go to Admin Panel**
   - Login to your Timesheet app
   - Click "Admin" in the navigation
   - Go to "SMTP Settings" tab

2. **Select Basic Auth**
   - Choose "Basic Auth (Username & Password)" from the dropdown
   - Fill in the fields:
     - **SMTP Host:** `smtp.office365.com`
     - **SMTP Port:** `587`
     - **Email Address:** Your full Microsoft 365 email
     - **Password:** Your Microsoft 365 password OR app-specific password
   - Leave **"Use SSL/TLS"** unchecked (we use STARTTLS on port 587)

3. **Configure Recipients**
   - **From Email Address:** Your email address
   - **To Email Address:** Where timesheets should be sent (e.g., `info@eutransport.nl`)

4. **Test the Connection**
   - Click "Test Connection"
   - Wait for success message

### Important Notes:

- If you have **2FA enabled**, you MUST use an **App-Specific Password**:
  - Go to https://account.microsoft.com/account/manage-my-microsoft-account
  - Click "Security" → "App passwords"
  - Generate a new app password for "Mail and Calendar"
  - Use this password instead of your regular password

---

## Method 2: OAuth2 Authentication (Recommended)

### Advantages:
✅ **No password storage** - More secure  
✅ **Works with 2FA enabled** - No special app passwords needed  
✅ **Fine-grained permissions** - Only "Mail.Send" permission  
✅ **Easy to revoke** - Can disable at any time from Azure Portal  

### Setup Steps:

#### Step 1: Create Azure App Registration

1. Sign in to [Azure Portal](https://portal.azure.com)
2. Search for "App registrations"
3. Click "+ New registration"
4. Fill in the form:
   - **Name:** `Timesheet SMTP App`
   - **Supported account types:** `Accounts in this organizational directory only`
   - Click "Register"

#### Step 2: Get Your Tenant ID

1. On your app's page, look for "Directory (tenant) ID"
2. **Copy this value** - you'll need it later
3. Example format: `12345678-1234-1234-1234-123456789012`

#### Step 3: Create Client Secret

1. On your app's page, go to "Certificates & secrets"
2. Under "Client secrets", click "+ New client secret"
3. Fill in:
   - **Description:** `SMTP Client Secret`
   - **Expires:** Choose a suitable period (e.g., 1 year, 2 years)
4. Click "Add"
5. **IMPORTANT:** Copy the "Value" immediately - it will only show once!
6. Paste it somewhere safe (you'll need it in a few steps)

#### Step 4: Grant Mail Sending Permission

1. On your app's page, go to "API permissions"
2. Click "+ Add a permission"
3. Choose "Microsoft Graph"
4. Select "Application permissions" (not Delegated)
5. Search for "Mail.Send"
6. Check the box and click "Add permissions"
7. You should see "Mail.Send" is now listed
8. Click "Grant admin consent for [Your Organization]"
9. Wait for the status to show as "Granted"

#### Step 5: Configure in Timesheet App

1. Go to your Timesheet app Admin panel
2. Click "SMTP Settings" tab
3. Select **"Microsoft 365 OAuth2 (Recommended)"** from the dropdown
4. Fill in:
   - **Email Address:** Your Microsoft 365 email
   - **Azure Tenant ID:** Paste from Step 2
   - **Client ID:** Paste from your app's Overview page (Application (client) ID)
   - **Client Secret:** Paste the value from Step 3
   - **OAuth Scope:** (Leave as default) `https://outlook.office365.com/.default`
5. Fill in email recipients:
   - **From Email Address:** Your email
   - **To Email Address:** Where timesheets go (e.g., `info@eutransport.nl`)
6. Click "Save SMTP Settings"

#### Step 6: Test the Connection

1. Click "Test Connection"
2. If successful, you'll see: "SMTP connection successful! Test email sent."
3. Check your email to confirm the test message arrived

---

## Troubleshooting

### "SMTP test failed: Invalid credentials"

**Basic Auth:**
- Verify your email address is correct
- If using 2FA, ensure you're using an app-specific password
- Password may have special characters - ensure it's entered correctly

**OAuth2:**
- Verify Tenant ID, Client ID, and Client Secret are copied correctly (no extra spaces)
- Ensure "Mail.Send" permission is granted and shows "Granted" in Azure
- Check that the app registration is in the correct tenant

### "SMTP test failed: Connection timed out"

- Your firewall/antivirus may be blocking port 587
- Try port 465 with SSL enabled instead
- Check if your network allows outbound connections on these ports

### "SMTP test failed: TLS required"

- If using Basic Auth on port 465, uncheck "Use SSL/TLS" and try port 587
- Ensure "Use SSL/TLS" is properly configured based on your port choice

### Test email sent but timesheets aren't sending

- Check that "To Email Address" is correct
- Check your email spam folder
- Try testing the connection again
- Check the server logs for error messages

---

## Quick Reference

### Microsoft Office 365 Settings

| Setting | Value |
|---------|-------|
| **SMTP Host** | `smtp.office365.com` |
| **Port (STARTTLS)** | `587` |
| **Port (SSL)** | `465` |
| **Use SSL/TLS** | Uncheck for 587, Check for 465 |
| **Authentication** | Basic Auth or OAuth2 |

### OAuth2 Endpoints

- **Azure Portal:** https://portal.azure.com
- **App Registrations:** https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade
- **Azure AD OAuth2 Token Endpoint:** https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token

---

## Security Best Practices

1. **Use OAuth2** when possible - it's more secure
2. **Never share** your Client Secret - treat it like a password
3. **Rotate secrets** periodically (set expiration dates in Azure)
4. **Limit permissions** - Mail.Send is the only permission needed
5. **Monitor usage** - Check Azure logs periodically
6. **Use strong admin password** - Change the default admin password immediately

---

## Need Help?

If you encounter issues:

1. Check the **troubleshooting section** above
2. Review the **server logs** in the terminal
3. Test the connection with the "Test Connection" button
4. Verify all credentials are entered correctly (no extra spaces)
5. Check the [Microsoft Graph API Documentation](https://docs.microsoft.com/graph)

