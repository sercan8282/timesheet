# Quick Start Guide

## Installation (5 minutes)

### 1. Install Node.js
- Download from https://nodejs.org/ (LTS version)
- Run installer, use default settings
- Restart VS Code after installation

### 2. Install Dependencies
Open Terminal in VS Code (Ctrl+`) and run:
```powershell
cd C:\timesheet-app
npm install
```

### 3. Configure Email
Edit `.env` file and update:
```env
SMTP_USER=your-email@yourdomain.com
SMTP_PASS=your-password
EMAIL_FROM=your-email@yourdomain.com
```

### 4. Initialize Database
```powershell
npm run init-db
```

### 5. Start Server
```powershell
npm start
```

### 6. Open Browser
Go to: http://localhost:3000

**Login**: `admin` / `Admin@123456`

## ⚠️ IMPORTANT: First Steps

1. **Change admin password** (click your name → Change Password)
2. **Update SMTP settings** (Admin → SMTP Settings tab)
3. **Create users** (Admin → Users → Add User)

## Common Commands

```powershell
# Start server
npm start

# Start with auto-restart (development)
npm run dev

# Reset database
Remove-Item database.sqlite
npm run init-db
```

## Need Help?

- Check README.md for detailed documentation
- Verify .env configuration
- Ensure port 3000 is available
- Check browser console (F12) for errors

## Features Overview

### Regular Users Can:
- ✅ Add/edit timesheet entries
- ✅ Auto-calculate hours and kilometers
- ✅ Preview timesheets as PDF
- ✅ Submit timesheets via email (XLSX)
- ✅ View submission history
- ✅ Change their password

### Admins Can:
- ✅ Everything users can do, plus:
- ✅ Create/delete users
- ✅ View all user submissions
- ✅ Configure SMTP email settings
- ✅ Manage system settings

---

**That's it! You're ready to go!** 🚀
