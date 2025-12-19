# Timesheet Management System

A comprehensive web-based timesheet management system with user authentication, admin portal, PDF/XLSX generation, and email integration.

## Features

✅ User authentication with JWT tokens  
✅ Secure password encryption (bcrypt)  
✅ Admin portal for user management  
✅ Timesheet entry with automatic calculations  
✅ Week number auto-calculation based on date  
✅ Excel (.xlsx) file generation for submissions  
✅ PDF generation for viewing history  
✅ Email integration with Microsoft Exchange Online (SMTP)  
✅ User-specific data isolation  
✅ Submission history tracking  
✅ Password change functionality  
✅ Responsive Bootstrap design (blue and white theme)  
✅ Mobile-friendly interface  
✅ Rate limiting and security headers  

## System Requirements

- **Node.js**: Version 14.x or higher
- **npm**: Version 6.x or higher
- **Web Browser**: Chrome, Firefox, Edge, or Safari (latest versions)
- **Email**: Microsoft Exchange Online account (for SMTP)

## Installation Instructions

### Step 1: Install Node.js and npm

1. **Download Node.js**:
   - Visit https://nodejs.org/
   - Download the LTS (Long Term Support) version
   - Run the installer and follow the installation wizard
   - Accept the license agreement
   - Keep default settings and click "Next" until installation completes

2. **Verify Installation**:
   - Open **Visual Studio Code**
   - Open a new Terminal: Go to `Terminal` → `New Terminal` (or press `` Ctrl+` ``)
   - Type the following commands to verify:
   ```powershell
   node --version
   npm --version
   ```
   - You should see version numbers (e.g., v18.17.0 and 9.6.7)

### Step 2: Open Project in VS Code

1. Open **Visual Studio Code**
2. Go to `File` → `Open Folder`
3. Navigate to `C:\timesheet-app`
4. Click "Select Folder"

### Step 3: Install Dependencies

1. Open the Terminal in VS Code (`` Ctrl+` `` or `Terminal` → `New Terminal`)
2. Make sure you're in the project directory:
   ```powershell
   cd C:\timesheet-app
   ```

3. Install all required packages:
   ```powershell
   npm install
   ```
   
   This will install:
   - Express (web server)
   - SQLite3 (database)
   - JWT (authentication)
   - Bcrypt (password encryption)
   - Nodemailer (email sending)
   - ExcelJS (Excel file generation)
   - PDFKit (PDF generation)
   - And other dependencies

   **Wait for installation to complete** (may take 2-5 minutes)

### Step 4: Configure Environment Variables

1. The `.env` file is already created. Open it in VS Code
2. **IMPORTANT**: Update the following settings:

   ```env
   # Change this to a strong, random secret key
   JWT_SECRET=your-super-secret-jwt-key-change-this-NOW-12345

   # Configure your Microsoft Exchange Online email
   SMTP_USER=your-email@yourdomain.com
   SMTP_PASS=your-email-password
   EMAIL_FROM=your-email@yourdomain.com
   EMAIL_TO=info@eutransport.nl
   ```

3. Save the file (Ctrl+S)

### Step 5: Initialize Database

Run the database initialization script:

```powershell
npm run init-db
```

This will:
- Create the SQLite database file
- Set up all tables (users, timesheets, submissions, smtp_settings)
- Create the default admin user:
  - **Username**: `admin`
  - **Password**: `Admin@123456`
- Initialize SMTP settings

**⚠️ IMPORTANT: Change the admin password immediately after first login!**

### Step 6: Start the Application

Start the server:

```powershell
npm start
```

Or for development with auto-restart:

```powershell
npm run dev
```

You should see:
```
Server running on http://localhost:3000
Environment: development
```

### Step 7: Access the Application

1. Open your web browser
2. Navigate to: **http://localhost:3000**
3. Login with:
   - **Username**: `admin`
   - **Password**: `Admin@123456`

## First-Time Setup Checklist

After logging in for the first time:

1. ✅ **Change Admin Password**:
   - Click on your name in top-right corner
   - Select "Change Password"
   - Enter current password: `Admin@123456`
   - Enter new strong password
   - Click "Change Password"

2. ✅ **Configure SMTP Settings** (Choose One Method):

   **Option A: Basic Authentication (Simple, but less secure)**
   - Go to "Admin" in the navigation
   - Click on "SMTP Settings" tab
   - Select "Basic Auth (Username & Password)"
   - Enter your Microsoft Exchange Online credentials:
     - Host: `smtp.office365.com`
     - Port: `587`
     - Uncheck "Use SSL/TLS" (we use STARTTLS on port 587)
     - Username: Your full email address
     - Password: Your email password (or app-specific password if 2FA is enabled)
     - From Email: Your email address
     - To Email: `info@eutransport.nl`
   - Click "Save SMTP Settings"

   **Option B: Modern Microsoft 365 OAuth2 (Recommended - More Secure)**
   
   This method is more secure and doesn't require storing passwords.
   
   **Step 1: Create Azure App Registration**
   1. Sign in to [Azure Portal](https://portal.azure.com)
   2. Go to "Azure Active Directory" → "App registrations"
   3. Click "+ New registration"
   4. Name: "Timesheet SMTP App"
   5. Supported account types: "Accounts in this organizational directory only"
   6. Click "Register"
   
   **Step 2: Get Your Tenant ID**
   1. On the app page, copy the "Directory (tenant) ID"
   2. Save this for later
   
   **Step 3: Create Client Secret**
   1. Go to "Certificates & secrets"
   2. Click "+ New client secret"
   3. Description: "SMTP Password"
   4. Expiry: Choose suitable period (e.g., 1 year)
   5. Copy the "Value" immediately (you won't see it again)
   6. Save this for later
   
   **Step 4: Grant Permissions**
   1. Go to "API permissions"
   2. Click "+ Add a permission"
   3. Select "Microsoft Graph"
   4. Select "Application permissions"
   5. Search and add: "Mail.Send"
   6. Click "Grant admin consent for [Your Organization]"
   
   **Step 5: Configure in Timesheet App**
   - Go to "Admin" → "SMTP Settings" tab
   - Select "Microsoft 365 OAuth2 (Recommended)"
   - Fill in:
     - Email Address: Your Microsoft 365 email
     - Azure Tenant ID: Paste the Directory ID from Step 2
     - Client ID: Copy from your app registration page
     - Client Secret: Paste the value from Step 3
   - Click "Save SMTP Settings"

3. ✅ **Create Users**:
   - Go to "Admin" → "Users" tab
   - Click "Add User"
   - Fill in username, full name, and password
   - Uncheck "Admin User" for regular users
   - Click "Create User"

## How to Use

### For Regular Users

#### Adding Timesheet Entries

1. Login with your username and password
2. You'll see the Dashboard with timesheet entry form
3. Fill in the fields:
   - **Week Number**: Auto-calculated from date
   - **Name**: Auto-filled with your name
   - **Date**: Select the work date
   - **Start Time**: When you started work (e.g., 09:00)
   - **End Time**: When you finished work (e.g., 17:00)
   - **Start KM**: Odometer reading at start
   - **End KM**: Odometer reading at end
   - **Pause Time**: Break duration (e.g., 00:30 for 30 minutes)
   - **Total Hours**: Auto-calculated (End - Start - Pause)
   - **Total KM**: Auto-calculated (End KM - Start KM)

4. Click "Add Row" to add more entries
5. Click "Save All" to save your entries

#### Submitting Timesheets

1. After saving entries, click "Preview PDF" to review
2. Click "Submit & Send Email" to submit
3. The system will:
   - Generate an Excel (.xlsx) file
   - Email it to info@eutransport.nl
   - Save the submission to your history

#### Viewing History

1. Click "History" in the navigation
2. Click on any submission card to view the PDF

### For Administrators

#### Managing Users

1. Login as admin
2. Go to "Admin" → "Users"
3. View all users, create new users, or delete users
4. Note: Cannot delete the last admin user

#### Viewing All Submissions

1. Go to "Admin" → "Submissions"
2. View submissions from all users
3. Click "View PDF" to see any submission

#### SMTP Configuration

1. Go to "Admin" → "SMTP Settings"
2. Update email server settings as needed
3. Password field can be left blank to keep existing password

## Project Structure

```
timesheet-app/
├── config/
│   └── database.js          # Database configuration
├── middleware/
│   └── auth.js              # JWT authentication middleware
├── routes/
│   ├── auth.js              # Login routes
│   ├── user.js              # User routes (timesheets, profile)
│   ├── admin.js             # Admin routes (user management, submissions)
│   └── submission.js        # Submission and PDF generation routes
├── scripts/
│   └── init-db.js           # Database initialization script
├── utils/
│   ├── email.js             # Email sending utility
│   ├── excel.js             # XLSX generation utility
│   └── pdf.js               # PDF generation utility
├── public/
│   ├── css/
│   │   └── style.css        # Custom styles
│   ├── js/
│   │   ├── api.js           # API client
│   │   ├── app.js           # Main application logic
│   │   ├── auth.js          # Login & password change
│   │   ├── dashboard.js     # Timesheet entry page
│   │   ├── history.js       # Submission history page
│   │   └── admin.js         # Admin portal
│   └── index.html           # Main HTML file
├── .env                     # Environment variables (IMPORTANT!)
├── .env.example             # Example environment file
├── package.json             # Project dependencies
├── server.js                # Main server file
└── database.sqlite          # SQLite database (created after init)
```

## Security Features

- ✅ **Password Encryption**: Bcrypt with salt rounds
- ✅ **JWT Tokens**: Secure authentication with expiration
- ✅ **SQL Injection Protection**: Parameterized queries
- ✅ **XSS Protection**: Helmet.js security headers
- ✅ **Rate Limiting**: 100 requests per 15 minutes per IP
- ✅ **HTTPS Support**: Can be configured with reverse proxy
- ✅ **Password Validation**: Minimum 6 characters
- ✅ **Session Management**: Token-based authentication

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login

### User Endpoints
- `GET /api/user/me` - Get current user info
- `POST /api/user/change-password` - Change password
- `GET /api/user/timesheets` - Get user's timesheets
- `POST /api/user/timesheets` - Create timesheet entry
- `PUT /api/user/timesheets/:id` - Update timesheet entry
- `DELETE /api/user/timesheets/:id` - Delete timesheet entry
- `GET /api/user/submissions` - Get user's submissions

### Submission Endpoints
- `POST /api/submission/submit` - Submit timesheets via email
- `POST /api/submission/preview-pdf` - Preview PDF
- `GET /api/submission/submissions/:id/pdf` - Get submission PDF

### Admin Endpoints (Admin only)
- `GET /api/admin/users` - Get all users
- `POST /api/admin/users` - Create new user
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/submissions` - Get all submissions
- `GET /api/admin/submissions/:id/timesheets` - Get submission timesheets
- `GET /api/admin/smtp-settings` - Get SMTP settings
- `PUT /api/admin/smtp-settings` - Update SMTP settings

## Troubleshooting

### Server won't start

1. Make sure port 3000 is not in use:
   ```powershell
   netstat -ano | findstr :3000
   ```

2. If port is in use, change it in `.env`:
   ```env
   PORT=3001
   ```

### Database errors

Delete `database.sqlite` and run initialization again:
```powershell
Remove-Item database.sqlite
npm run init-db
```

### Email not sending

1. Verify SMTP settings in Admin portal
2. Check if your email provider allows SMTP
3. If using 2FA, generate an app-specific password
4. Check firewall/antivirus isn't blocking port 587

### Can't login

Reset admin password by reinitializing database:
```powershell
Remove-Item database.sqlite
npm run init-db
```

## Support

For issues or questions, check the following:
1. Ensure all dependencies are installed (`npm install`)
2. Check `.env` file is properly configured
3. Verify database is initialized (`npm run init-db`)
4. Check browser console for JavaScript errors (F12)
5. Check server terminal for error messages

## License

ISC License

---

**Default Admin Credentials**:
- Username: `admin`
- Password: `Admin@123456`

**⚠️ CHANGE THESE IMMEDIATELY AFTER FIRST LOGIN!**
