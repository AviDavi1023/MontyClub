# Password Reset System

## Overview

The password reset system uses a two-step approval process where reset requests are sent to the primary admin's email for approval/forwarding.

## How It Works

### 1. Initial Setup (First Login)
- When the primary admin logs in for the first time, they'll be prompted to set their email address
- This email receives all password reset requests
- The first admin created is automatically marked as the primary admin

### 2. Password Reset Request
- Any admin can click "Forgot password?" on the login screen
- They enter their username to request a reset
- A reset code is generated (valid for 60 minutes)
- An email is sent to the primary admin's email with:
  - Username requesting the reset
  - The reset code to forward
  - Expiration time

### 3. Password Reset Completion
- The admin receives the reset code from the primary admin
- They paste the code into the reset form
- They enter and confirm their new password
- The password is updated and they can log in

## API Endpoints

### POST /api/auth/request-reset
Request a password reset for a username.
- **Body:** `{ username: string }`
- **Response:** Success message (code included in development mode)
- **Email:** Sends reset code to primary admin's email

### POST /api/auth/reset-password
Complete password reset with a valid code.
- **Body:** `{ resetToken: string, newPassword: string }`
- **Response:** Success/error message

### POST /api/admin/set-primary-email
Set or update the primary admin's email.
- **Headers:** `x-admin-key` (required)
- **Body:** `{ email: string }`
- **Response:** Updated email confirmation

## One-Time Factory Reset

For this deployment only, the system performs a complete data wipe on first load to ensure clean setup with the new email field structure.

### What Gets Deleted
- All clubs snapshot data
- All announcements
- All update requests
- All admin users
- All registration collections
- All registration submissions
- All settings

### How It Works
- On first page load, checks if `montyclub:factoryResetDone` exists in localStorage
- If not found, calls `/api/admin/factory-reset` endpoint
- Sets the flag after completion to prevent repeated resets
- Shows a toast notification confirming the reset

### After Factory Reset
1. Visit the admin panel
2. Go through the initial setup process to create your admin account (if it's the first time)
3. Log in with your admin credentials
3. Set your primary admin email when prompted
4. Set your admin API key
5. Change the default password immediately
6. Create your club catalog and registration collections

## Production Email Integration

To enable actual email sending in production:

1. Install an email service library (e.g., nodemailer, sendgrid, resend)
2. Update `/app/api/auth/request-reset/route.ts` to send emails instead of returning the token
3. Remove the `resetCode` field from the response
4. Configure email templates with:
   - Reset code display
   - Requester username
   - Expiration time
   - Instructions for forwarding

Example email template:
```
Subject: Password Reset Request - ${username}

Hello,

Admin user "${username}" has requested a password reset for the MontyClub system.

Please forward this reset code to them:

${resetToken}

This code expires in 60 minutes.

If you did not expect this request, you can safely ignore this email.
```

## Security Features

- Reset codes expire after 60 minutes
- Codes are single-use only
- Failed requests don't reveal if username exists
- Primary admin approval required for all resets
- Passwords must be at least 8 characters
- All tokens invalidated after successful reset

## Future Enhancements

- Multiple primary admins with email distribution
- Email templates with branding
- Reset code history/audit log
- Configurable token expiration times
- SMS/2FA options for high-security environments
