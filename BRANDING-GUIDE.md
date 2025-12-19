# Branding Customization Guide

This guide explains how to customize the appearance of your Timesheet Management System with your own company branding.

## Features

The branding system allows you to customize:
- **Company Name**: Displayed on login page, navigation, and PDFs
- **Logo**: Your company logo shown on login page, navigation, and PDFs
- **Primary Color**: Main theme color for the navigation bar and PDF headers

## How to Customize Branding

### Step 1: Access Branding Settings

1. Login as an **admin** user
2. Click **"Admin"** in the navigation menu
3. Click the **"Branding"** tab

### Step 2: Customize Company Name

1. In the **"Company Name"** field, enter your company name
2. This will replace "Timesheet System" throughout the application
3. Click **"Save Settings"**

### Step 3: Upload Your Logo

1. Click **"Choose File"** under "Upload New Logo"
2. Select your logo file (JPG, PNG, GIF, or SVG)
3. Click **"Upload Logo Only"** or **"Save Settings"**

**Logo Recommendations:**
- Format: PNG with transparency works best
- Size: 200x200px or larger (will be auto-scaled)
- Aspect Ratio: Square or rectangular horizontal logos work best
- File Size: Maximum 5MB
- Quality: Use high-resolution images for best results

### Step 4: Choose Primary Color

1. Click the **color picker** under "Primary Color"
2. Select your company's primary brand color
3. This color will be used for:
   - Navigation bar background
   - PDF report headers
   - Accent elements
4. Click **"Save Settings"**

### Step 5: Refresh to See Changes

After saving changes, refresh the browser to see your new branding applied throughout the application.

## Where Branding Appears

### Login Page
- Logo displayed at the top (if uploaded)
- Company name shown prominently
- Primary color used for buttons

### Navigation Bar
- Logo shown next to company name (if uploaded)
- Company name in the navbar brand
- Primary color as navbar background

### PDF Reports
- Logo in the header (if uploaded)
- Company name included in report details
- Primary color for table headers

## Managing Logo Files

Uploaded logos are stored in:
```
public/uploads/
```

**Note**: Only one logo can be active at a time. Uploading a new logo will replace the previous one.

## Tips for Best Results

1. **Use a Transparent PNG**: This ensures your logo looks good on any background
2. **Keep It Simple**: Logos with too much detail may not scale well at smaller sizes
3. **Test on Different Devices**: Check how your branding looks on desktop and mobile
4. **Choose Contrasting Colors**: Ensure text is readable against your primary color
5. **Backup Your Logo**: Keep a copy of your logo file in a safe location

## Default Settings

If no branding is configured, the system uses these defaults:
- **Company Name**: "Timesheet System"
- **Logo**: Calendar icon
- **Primary Color**: #0066CC (Blue)

## Reverting to Defaults

To revert to default branding:
1. Go to Admin → Branding
2. Change company name to "Timesheet System"
3. Set primary color to #0066CC
4. (Logo will remain if uploaded, but can be ignored)

## Technical Details

### Database Table
Branding settings are stored in the `branding_settings` table:
- `company_name`: Company name (TEXT)
- `logo_path`: Path to logo file (TEXT)
- `primary_color`: Hex color code (TEXT)

### API Endpoints
- `GET /api/branding` - Public endpoint for branding (used on login page)
- `GET /api/admin/branding-settings` - Get branding settings (admin only)
- `PUT /api/admin/branding-settings` - Update branding settings (admin only)
- `POST /api/admin/branding-settings/logo` - Upload logo (admin only)

### File Upload Restrictions
- Maximum file size: 5MB
- Allowed formats: JPEG, JPG, PNG, GIF, SVG
- Files are stored with the name "logo.[extension]"

## Troubleshooting

### Logo Not Appearing
- Check if the file uploaded successfully (look for success message)
- Verify file is in `public/uploads/` directory
- Ensure file format is supported
- Try refreshing the browser with Ctrl+F5 (hard refresh)

### Color Not Changing
- Make sure you clicked "Save Settings"
- Refresh the browser to see changes
- Clear browser cache if needed

### PDF Logo Issues
- Ensure logo file exists in `public/uploads/`
- SVG files may have compatibility issues - use PNG instead
- Check logo file is not corrupted

## Support

For additional help or issues with branding customization, check:
- Main README.md file
- Server console for error messages
- Browser console (F12) for frontend errors

---

**Remember**: Only admin users can modify branding settings. Regular users will see the configured branding but cannot change it.
