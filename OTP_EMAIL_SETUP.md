# OTP Email Authentication System

This document explains the OTP (One-Time Password) email authentication system implemented using Nodemailer.

## Features

✅ **Email OTP Login** - Users can log in using OTP sent to their email
✅ **Password Reset via OTP** - Secure password reset using email verification
✅ **Password Change** - Change password using either current password or OTP
✅ **Quick Signup** - Create account with automatically generated password sent to email
✅ **Professional Email Templates** - Beautiful HTML email templates for all communications

## Setup Instructions

### 1. Gmail Configuration

To use Gmail for sending emails, you need to create an **App Password**:

1. Go to your Google Account: https://myaccount.google.com/
2. Navigate to **Security**
3. Enable **2-Step Verification** (if not already enabled)
4. Under "2-Step Verification", find and click **App passwords**
5. Select app: **Mail**
6. Select device: **Other (Custom name)** - enter "Phone Wraps Backend"
7. Click **Generate**
8. Copy the 16-character app password

### 2. Environment Variables

Update your `.env` file in the BACKEND/Src directory:

```env
# Email Configuration (Gmail with Nodemailer)
EMAIL_USER=your-email@gmail.com
EMAIL_APP_PASSWORD=your-16-char-app-password

# Frontend URL for email links
FRONTEND_URL=http://localhost:3000
```

**Important Notes:**
- Use the App Password, NOT your regular Gmail password
- Never commit the `.env` file to version control
- For production, use environment variables provided by your hosting service

### 3. Install Dependencies

Navigate to the backend directory and install nodemailer:

```bash
cd BACKEND
npm install
```

This will install nodemailer along with other dependencies.

## API Endpoints

### Authentication Routes

#### 1. Send OTP for Login
```http
POST /api/auth/send-email-otp
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "OTP sent successfully to your email",
  "expiresIn": "10 minutes"
}
```

#### 2. Verify OTP and Login
```http
POST /api/auth/verify-email-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "userId": "...",
  "token": "...",
  "user": {
    "id": "...",
    "name": "...",
    "email": "...",
    "phone": "..."
  }
}
```

#### 3. Quick Signup (Random Password)
```http
POST /api/auth/signup-email
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com"
}
```

**Response:**
```json
{
  "message": "Account created successfully! Your password has been sent to your email.",
  "userId": "...",
  "email": "john@example.com"
}
```

#### 4. Request Password Reset
```http
POST /api/auth/request-password-reset
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "Password reset OTP sent to your email",
  "expiresIn": "10 minutes"
}
```

#### 5. Reset Password
```http
POST /api/auth/reset-password
Content-Type: application/json

{
  "email": "user@example.com",
  "otp": "123456",
  "newPassword": "newSecurePassword123"
}
```

**Response:**
```json
{
  "message": "Password reset successfully. You can now login with your new password."
}
```

#### 6. Change Password (Logged-in Users)
```http
POST /api/auth/change-password
Content-Type: application/json

{
  "email": "user@example.com",
  "currentPassword": "oldPassword",  // OR use otp
  "newPassword": "newSecurePassword123"
}
```

Alternatively, use OTP instead of current password:
```json
{
  "email": "user@example.com",
  "otp": "123456",
  "newPassword": "newSecurePassword123"
}
```

**Response:**
```json
{
  "message": "Password changed successfully"
}
```

## Frontend Pages

### 1. Login Page
**Path:** `/Auth/Login`

Features:
- Tab switcher: Password Login or OTP Login
- OTP login flow:
  1. Enter email
  2. Click "Send OTP"
  3. Enter 6-digit OTP
  4. Click "Verify & Login"
- Link to password reset page

### 2. Reset Password Page
**Path:** `/Auth/ResetPassword`

Features:
- Step 1: Enter email to receive OTP
- Step 2: Enter OTP and new password
- Automatic redirect to login after successful reset

### 3. Change Password Page
**Path:** `/Auth/ChangePassword`

Features:
- Two methods: Current Password or OTP
- Must be logged in to access
- Redirects to profile after success

### 4. Signup Page
**Path:** `/Auth/SignUp`

Features:
- Manual signup: Choose your own password
- Quick signup: Get random password via email

## Email Templates

### 1. OTP Email
Sent when user requests OTP for login or password reset.
- 6-digit OTP code
- Valid for 10 minutes
- Security warning

### 2. Password Email
Sent when user signs up with quick signup.
- Random generated password
- Instructions to change password
- Link to website

### 3. Password Reset Confirmation
Sent after successful password change.
- Confirmation message
- Security alert if user didn't make the change

## Security Features

### OTP Security
- **Expiration:** OTPs expire after 10 minutes
- **One-time use:** OTPs are deleted after verification
- **6-digit code:** Provides good balance between security and usability

### Password Requirements
- Minimum 6 characters
- Random passwords generated are 8-12 characters with mix of:
  - Lowercase letters
  - Uppercase letters
  - Numbers
  - Special symbols (!@#$%^&*)

### Database Security
- OTP and otpExpiry fields have `select: false` to prevent accidental exposure
- Passwords are hashed using bcrypt with salt rounds of 10

## Testing

### Test OTP Login

1. **Start Backend:**
   ```bash
   cd BACKEND
   npm run dev
   ```

2. **Start Frontend:**
   ```bash
   cd FRONTEND
   npm run dev
   ```

3. **Test Flow:**
   - Navigate to http://localhost:3000/Auth/Login
   - Switch to "OTP" tab
   - Enter a registered user's email
   - Click "Send OTP"
   - Check your email for the OTP
   - Enter the OTP and click "Verify & Login"

### Test Password Reset

1. Navigate to http://localhost:3000/Auth/ResetPassword
2. Enter your email
3. Check email for OTP
4. Enter OTP and new password
5. Login with new password

### Test Quick Signup

1. Navigate to http://localhost:3000/Auth/SignUp
2. Switch to "Quick Signup" tab
3. Enter name and email
4. Click "Create Account"
5. Check email for password
6. Login with the received password

## Troubleshooting

### Emails Not Sending

1. **Check Gmail App Password:**
   - Make sure you're using the App Password, not your regular password
   - Verify 2-Step Verification is enabled

2. **Check Environment Variables:**
   ```bash
   # In backend, check if variables are loaded
   console.log('Email User:', process.env.EMAIL_USER)
   console.log('Has App Password:', !!process.env.EMAIL_APP_PASSWORD)
   ```

3. **Check Gmail Security:**
   - Ensure "Less secure app access" is NOT blocking the app password
   - Check Google Account security notifications

4. **Test Email Service:**
   Create a test script:
   ```javascript
   const { sendOTPEmail } = require('./Src/services/email.service');
   
   sendOTPEmail('your-test-email@gmail.com', '123456', 'login')
     .then(() => console.log('✅ Email sent successfully'))
     .catch(err => console.error('❌ Error:', err));
   ```

### OTP Expired

- OTPs are valid for 10 minutes
- Request a new OTP if expired
- Check server time is synchronized

### User Not Found

- Make sure user account exists
- For OTP login, user must have registered first
- For quick signup, email must not already be registered

## Production Deployment

### Environment Variables

Set these on your hosting platform (Vercel, Heroku, etc.):

```env
EMAIL_USER=your-production-email@gmail.com
EMAIL_APP_PASSWORD=your-app-password
FRONTEND_URL=https://your-production-domain.com
```

### Email Service Alternatives

For production, consider using dedicated email services:

1. **SendGrid** - High deliverability, free tier available
2. **Amazon SES** - Cost-effective for high volume
3. **Mailgun** - Developer-friendly API
4. **Resend** - Modern email API

To switch from Gmail to another service, update `email.service.js` transporter configuration.

## Code Structure

```
BACKEND/
├── Src/
│   ├── services/
│   │   └── email.service.js       # Email sending logic
│   ├── utils/
│   │   └── authHelpers.js         # OTP generation, password utilities
│   ├── controllers/
│   │   └── auth.controller.js     # Auth endpoints
│   └── routes/
│       └── auth.routes.js         # Auth routes

FRONTEND/
├── src/app/Auth/
│   ├── Login/
│   │   └── page.jsx               # Login with password/OTP
│   ├── SignUp/
│   │   └── page.jsx               # Manual/Quick signup
│   ├── ResetPassword/
│   │   └── page.jsx               # Password reset
│   └── ChangePassword/
│       └── page.jsx               # Change password
```

## Support

For issues or questions:
1. Check console logs in browser and server
2. Verify environment variables are set correctly
3. Test email service independently
4. Check MongoDB connection for user data

---

**Last Updated:** February 2026
**Version:** 1.0.0
