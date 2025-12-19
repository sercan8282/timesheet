# ✅ Installation Checklist

Use this checklist to ensure proper installation and setup.

## Pre-Installation

- [ ] Visual Studio Code is installed
- [ ] Internet connection is available

## Installation Steps

### 1. Install Node.js
- [ ] Downloaded Node.js LTS from https://nodejs.org/
- [ ] Ran the installer
- [ ] Completed installation
- [ ] Restarted VS Code

### 2. Verify Node.js Installation
- [ ] Opened Terminal in VS Code (Ctrl+`)
- [ ] Ran `node --version` - saw version number
- [ ] Ran `npm --version` - saw version number

### 3. Install Project Dependencies
- [ ] Navigated to `C:\timesheet-app` folder
- [ ] Opened folder in VS Code
- [ ] Opened Terminal
- [ ] Ran `npm install`
- [ ] Installation completed without errors

### 4. Configure Environment
- [ ] Opened `.env` file
- [ ] Updated `JWT_SECRET` to a random string
- [ ] Updated `SMTP_USER` with email address
- [ ] Updated `SMTP_PASS` with email password
- [ ] Updated `EMAIL_FROM` with email address
- [ ] Verified `EMAIL_TO` is set to info@eutransport.nl
- [ ] Saved `.env` file

### 5. Initialize Database
- [ ] Ran `npm run init-db`
- [ ] Saw success messages
- [ ] Database file created (database.sqlite)

### 6. Start Server
- [ ] Ran `npm start`
- [ ] Saw "Server running on http://localhost:3000"
- [ ] No errors in terminal

### 7. Access Application
- [ ] Opened browser
- [ ] Went to http://localhost:3000
- [ ] Saw login page
- [ ] Login page styled correctly (blue and white)

## First Login & Configuration

### 8. Initial Login
- [ ] Logged in with username: `admin`
- [ ] Logged in with password: `Admin@123456`
- [ ] Successfully entered dashboard

### 9. Change Admin Password
- [ ] Clicked on username in top-right
- [ ] Selected "Change Password"
- [ ] Entered current password: `Admin@123456`
- [ ] Entered new strong password
- [ ] Confirmed new password
- [ ] Password changed successfully
- [ ] **Wrote down new admin password in secure location**

### 10. Configure SMTP Settings
- [ ] Clicked "Admin" in navigation
- [ ] Clicked "SMTP Settings" tab
- [ ] Entered SMTP Host: `smtp.office365.com`
- [ ] Entered SMTP Port: `587`
- [ ] Unchecked "Use SSL/TLS" (using STARTTLS)
- [ ] Entered SMTP Username (full email)
- [ ] Entered SMTP Password
- [ ] Entered From Email
- [ ] Verified To Email: `info@eutransport.nl`
- [ ] Clicked "Save SMTP Settings"
- [ ] Saw success message

### 11. Create Test User
- [ ] Stayed in Admin portal
- [ ] Clicked "Users" tab
- [ ] Clicked "Add User" button
- [ ] Entered test username
- [ ] Entered test full name
- [ ] Entered test password
- [ ] Left "Admin User" unchecked
- [ ] Clicked "Create User"
- [ ] User appeared in list

### 12. Test User Login
- [ ] Logged out (click username → Logout)
- [ ] Logged in with test user credentials
- [ ] Successfully entered dashboard
- [ ] Admin menu NOT visible (correct)

## Functionality Testing

### 13. Test Timesheet Entry
- [ ] Clicked "Dashboard" in navigation
- [ ] Saw timesheet entry form
- [ ] Week number auto-filled
- [ ] Name auto-filled
- [ ] Entered date
- [ ] Entered start time
- [ ] Entered end time
- [ ] Entered start KM
- [ ] Entered end KM
- [ ] Entered pause time
- [ ] Total hours calculated automatically
- [ ] Total KM calculated automatically
- [ ] Clicked "Add Row" - new row appeared
- [ ] Clicked "Save All"
- [ ] Saw success message

### 14. Test PDF Preview
- [ ] With saved timesheets
- [ ] Clicked "Preview PDF"
- [ ] PDF opened in new tab
- [ ] PDF shows all data correctly
- [ ] PDF has blue header

### 15. Test Email Submission
- [ ] With saved timesheets
- [ ] Clicked "Submit & Send Email"
- [ ] Confirmed submission
- [ ] Saw success message
- [ ] Checked email inbox (info@eutransport.nl)
- [ ] Received email with XLSX attachment
- [ ] Opened XLSX file
- [ ] All data present and correct

### 16. Test History
- [ ] Clicked "History" in navigation
- [ ] Saw submitted timesheet(s)
- [ ] Clicked on submission card
- [ ] PDF opened correctly

### 17. Test Admin Functions (login as admin)
- [ ] Logged out
- [ ] Logged in as admin
- [ ] Went to Admin portal
- [ ] Clicked "Submissions" tab
- [ ] Saw all users' submissions
- [ ] Clicked "View PDF" on a submission
- [ ] PDF opened correctly

## Mobile Responsiveness Testing

### 18. Test on Mobile/Tablet
- [ ] Opened browser DevTools (F12)
- [ ] Clicked mobile view icon
- [ ] Tested different screen sizes
- [ ] Navigation menu collapses on mobile
- [ ] Forms are usable on small screens
- [ ] Tables scroll horizontally if needed
- [ ] All buttons are tappable

## Security Verification

### 19. Verify Security Features
- [ ] Passwords are NOT visible in database (encrypted)
- [ ] Regular user cannot access Admin menu
- [ ] Regular user cannot see other users' timesheets
- [ ] Regular user cannot see other users' submissions
- [ ] JWT token expires after 24 hours
- [ ] Rate limiting works (100 requests/15 min)

## Performance Check

### 20. Verify Performance
- [ ] Pages load quickly (< 2 seconds)
- [ ] No console errors (F12 → Console)
- [ ] No network errors (F12 → Network)
- [ ] Calculations happen instantly
- [ ] PDF generates in < 5 seconds
- [ ] XLSX generates in < 5 seconds

## Final Checks

- [ ] All features working correctly
- [ ] No errors in browser console
- [ ] No errors in server terminal
- [ ] Database file exists (database.sqlite)
- [ ] Environment variables configured
- [ ] SMTP working and sending emails
- [ ] Admin password changed from default
- [ ] Users can be created and login
- [ ] Data isolation working correctly
- [ ] Mobile responsive
- [ ] Blue and white theme applied
- [ ] All documentation read

## Optional: Production Deployment

- [ ] Changed `NODE_ENV` to `production` in `.env`
- [ ] Using strong JWT_SECRET
- [ ] Using HTTPS (if deployed online)
- [ ] Database backed up regularly
- [ ] Server auto-starts on system boot
- [ ] Error logging configured
- [ ] Monitoring set up

---

## ✅ Installation Complete!

If all items are checked, your Timesheet Management System is fully installed and operational!

## 📞 Need Help?

Refer to:
- **README.md** - Full documentation
- **QUICKSTART.md** - Quick reference
- **VSCODE-GUIDE.md** - VS Code specific help
- **PROJECT-SUMMARY.md** - Project overview

---

**Congratulations! You're ready to manage timesheets! 🎉**
