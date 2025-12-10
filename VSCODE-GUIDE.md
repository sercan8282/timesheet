# Visual Studio Code Installation & Usage Guide

## Step-by-Step Installation from VS Code

### Step 1: Install Node.js

1. **Download Node.js**:
   - Open your browser and go to: https://nodejs.org/
   - Click on the **LTS** (Long Term Support) version download button
   - Run the downloaded installer (`node-v*.msi`)
   - Follow the installation wizard:
     - Click "Next"
     - Accept the license agreement
     - Keep default installation path
     - **IMPORTANT**: Make sure "Add to PATH" is checked
     - Click "Install"
     - Wait for installation to complete
     - Click "Finish"

2. **Restart VS Code**:
   - Close VS Code completely
   - Open it again

3. **Verify Installation**:
   - In VS Code, press `` Ctrl+` `` to open Terminal
   - Type: `node --version` and press Enter
   - You should see something like: `v18.17.0`
   - Type: `npm --version` and press Enter
   - You should see something like: `9.6.7`

### Step 2: Open the Project

1. In VS Code, go to: `File` → `Open Folder...`
2. Navigate to: `C:\timesheet-app`
3. Click "Select Folder"
4. If prompted to trust the folder, click "Yes, I trust the authors"

### Step 3: Install Project Dependencies

**Method 1: Using Terminal (Recommended)**

1. Open Terminal in VS Code:
   - Press `` Ctrl+` `` (Control + backtick)
   - Or go to: `Terminal` → `New Terminal`

2. Ensure you're in the right directory:
   ```powershell
   pwd
   ```
   Should show: `C:\timesheet-app`

3. Install all dependencies:
   ```powershell
   npm install
   ```

4. Wait for installation (2-5 minutes). You'll see packages being downloaded.

**Method 2: Using VS Code Tasks**

1. Press `Ctrl+Shift+P` to open Command Palette
2. Type: `Tasks: Run Task`
3. Select: `Install Dependencies`
4. Wait for completion

### Step 4: Configure the Application

1. In VS Code Explorer (left sidebar), locate `.env` file
2. Click to open it
3. Update these lines with your actual email credentials:
   ```env
   SMTP_USER=your-email@yourdomain.com
   SMTP_PASS=your-email-password
   EMAIL_FROM=your-email@yourdomain.com
   ```
4. Save the file (`Ctrl+S`)

### Step 5: Initialize the Database

**Method 1: Using Terminal**
```powershell
npm run init-db
```

**Method 2: Using VS Code Tasks**
1. Press `Ctrl+Shift+P`
2. Type: `Tasks: Run Task`
3. Select: `Initialize Database`

You should see:
```
✓ Admin user created
  Username: admin
  Password: Admin@123456
✓ SMTP settings initialized
Database initialization complete!
```

### Step 6: Start the Server

**Method 1: Using Terminal**
```powershell
npm start
```

**Method 2: Using VS Code Tasks (Recommended)**
1. Press `Ctrl+Shift+B` (Build command)
2. Or press `Ctrl+Shift+P`, type `Tasks: Run Task`, select `Start Server`

**Method 3: Using Development Mode (Auto-restart on changes)**
```powershell
npm run dev
```

You should see:
```
Server running on http://localhost:3000
Environment: development
```

### Step 7: Open the Application

1. **In your browser**, navigate to: `http://localhost:3000`

2. **Or use VS Code's built-in browser**:
   - Press `Ctrl+Shift+P`
   - Type: `Simple Browser: Show`
   - Enter URL: `http://localhost:3000`

3. **Login with default credentials**:
   - Username: `admin`
   - Password: `Admin@123456`

## Running the Application

### Starting the Server

**Quick Start** (after initial setup):
1. Open VS Code
2. Open the project folder (`C:\timesheet-app`)
3. Press `` Ctrl+` `` to open Terminal
4. Run: `npm start`
5. Open browser to: `http://localhost:3000`

**Using VS Code Tasks**:
- Press `Ctrl+Shift+B` to run the default build task (starts server)
- Or `Ctrl+Shift+P` → `Tasks: Run Task` → `Start Server`

### Stopping the Server

- In the Terminal where the server is running, press `Ctrl+C`
- Type `Y` if asked to terminate

## VS Code Features & Tips

### Terminal Shortcuts
- `` Ctrl+` `` - Toggle terminal
- `Ctrl+Shift+` `` - Create new terminal
- Click the `+` button in terminal to create new terminal tab

### File Navigation
- `Ctrl+P` - Quick file open
- `Ctrl+Shift+E` - Toggle Explorer sidebar
- `Ctrl+B` - Toggle sidebar visibility

### Editing
- `Ctrl+S` - Save file
- `Ctrl+F` - Find in file
- `Ctrl+H` - Find and replace
- `Ctrl+/` - Toggle line comment

### Multiple Cursors
- `Alt+Click` - Add cursor at click position
- `Ctrl+Alt+Up/Down` - Add cursor above/below

### Running Tasks
- `Ctrl+Shift+B` - Run default build task
- `Ctrl+Shift+P` → `Tasks: Run Task` - Run any task

## Available VS Code Tasks

Access via `Ctrl+Shift+P` → `Tasks: Run Task`:

1. **Install Dependencies** - Runs `npm install`
2. **Initialize Database** - Runs `npm run init-db`
3. **Start Server** - Runs `npm start` (production mode)
4. **Start Server (Development)** - Runs `npm run dev` (auto-restart)

## Troubleshooting in VS Code

### "npm not recognized" Error

**Solution**:
1. Restart VS Code completely
2. If still not working, restart your computer
3. Verify Node.js installation by running installer again

### Port 3000 Already in Use

**Check what's using the port**:
```powershell
netstat -ano | findstr :3000
```

**Kill the process** (replace PID with actual number):
```powershell
taskkill /PID <PID> /F
```

**Or change the port**:
- Edit `.env` file
- Change `PORT=3000` to `PORT=3001`
- Restart server

### Terminal Not Opening

- Try `Terminal` → `New Terminal` from menu
- Or restart VS Code
- Check if PowerShell is set as default shell

### File Changes Not Detected

- Use development mode: `npm run dev`
- Or restart the server manually after changes

## Project Structure in VS Code

```
timesheet-app/
├── .vscode/              # VS Code configuration
│   ├── tasks.json        # Task definitions
│   ├── settings.json     # Workspace settings
│   └── extensions.json   # Recommended extensions
├── config/               # Backend configuration
├── middleware/           # Express middleware
├── routes/              # API routes
├── scripts/             # Utility scripts
├── utils/               # Helper utilities
├── public/              # Frontend files
│   ├── css/            # Stylesheets
│   ├── js/             # JavaScript files
│   └── index.html      # Main HTML
├── .env                 # Environment variables (CONFIGURE THIS!)
├── .gitignore          # Git ignore file
├── package.json        # Dependencies
├── server.js           # Main server file
└── README.md           # Documentation
```

## Recommended VS Code Extensions

Install these for better development experience:

1. **ESLint** - JavaScript linting
2. **Prettier** - Code formatting
3. **SQLite** - View database contents
4. **REST Client** - Test API endpoints

Install via:
- `Ctrl+Shift+X` to open Extensions
- Search and install each extension

## Development Workflow

### Making Changes

1. **Edit files** in VS Code
2. **Save** (`Ctrl+S`)
3. If using `npm run dev`, changes auto-reload
4. If using `npm start`, restart server:
   - Press `Ctrl+C` in terminal
   - Run `npm start` again
5. **Refresh browser** to see changes

### Debugging

1. **Check Terminal** - Server errors appear here
2. **Check Browser Console** - Press `F12` → Console tab
3. **Check Network Tab** - Press `F12` → Network tab for API calls

## Quick Reference Commands

```powershell
# Install dependencies
npm install

# Initialize database
npm run init-db

# Start production server
npm start

# Start development server (auto-reload)
npm run dev

# Reset database
Remove-Item database.sqlite
npm run init-db

# Check Node version
node --version

# Check npm version
npm --version

# List installed packages
npm list --depth=0
```

## Additional Resources

- **Node.js Documentation**: https://nodejs.org/docs/
- **Express.js Guide**: https://expressjs.com/
- **Bootstrap Documentation**: https://getbootstrap.com/docs/
- **VS Code Tips**: https://code.visualstudio.com/docs

## Getting Help

If you encounter issues:

1. Check the Terminal for error messages
2. Check Browser Console (F12)
3. Verify `.env` configuration
4. Try resetting the database
5. Restart VS Code
6. Check README.md for detailed docs

---

**Happy Coding! 🎉**
