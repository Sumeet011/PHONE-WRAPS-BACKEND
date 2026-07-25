const nodemailer = require('nodemailer');

const validateEmailConfig = () => {
  const emailUser = (process.env.EMAIL_USER || '').trim();
  const emailPass = (process.env.EMAIL_APP_PASSWORD || '').trim();

  const hasPlaceholderUser = !emailUser || emailUser === 'your-email@gmail.com';
  const hasPlaceholderPass = !emailPass || emailPass === 'your-app-password-here';

  if (hasPlaceholderUser || hasPlaceholderPass) {
    throw new Error('Email service is not configured. Set EMAIL_USER and EMAIL_APP_PASSWORD in BACKEND/Src/.env');
  }
};

// Create transporter with Gmail
const createTransporter = () => {
  validateEmailConfig();

  const emailUser = (process.env.EMAIL_USER || '').trim();
  const emailPass = (process.env.EMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
  const smtpHost = process.env.EMAIL_SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = Number(process.env.EMAIL_SMTP_PORT || 465);
  const smtpSecure = process.env.EMAIL_SMTP_SECURE
    ? process.env.EMAIL_SMTP_SECURE === 'true'
    : smtpPort === 465;

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    // Deployment environments can intermittently time out on SMTP; set explicit limits.
    connectionTimeout: Number(process.env.EMAIL_CONNECTION_TIMEOUT || 15000),
    greetingTimeout: Number(process.env.EMAIL_GREETING_TIMEOUT || 15000),
    socketTimeout: Number(process.env.EMAIL_SOCKET_TIMEOUT || 20000),
    family: 4,
    auth: {
      user: emailUser,
      pass: emailPass
    },
    tls: {
      minVersion: 'TLSv1.2'
    }
  });
};

const sendMailWithTimeout = async (transporter, mailOptions) => {
  const timeoutMs = Number(process.env.EMAIL_SEND_TIMEOUT || 20000);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const timeoutError = new Error(`Email send timed out after ${timeoutMs}ms`);
      timeoutError.code = 'EMAIL_SEND_TIMEOUT';
      reject(timeoutError);
    }, timeoutMs);

    transporter
      .sendMail(mailOptions)
      .then((info) => {
        clearTimeout(timer);
        resolve(info);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
};

// Send OTP email
const sendOTPEmail = async (email, otp, purpose = 'login') => {
  try {
    const transporter = createTransporter();
    
    const subject = purpose === 'password-reset' 
      ? 'Password Reset OTP - Phone Wraps'
      : 'Login OTP - Phone Wraps';
    
    const message = purpose === 'password-reset'
      ? `Your OTP for password reset is: <strong>${otp}</strong><br>This OTP is valid for 10 minutes.`
      : `Your OTP for login is: <strong>${otp}</strong><br>This OTP is valid for 10 minutes.`;

    const mailOptions = {
      from: `"Phone Wraps" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .otp-box { background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
            .otp-code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎨 Phone Wraps</h1>
              <p>Your Verification Code</p>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>${message}</p>
              <div class="otp-box">
                <div class="otp-code">${otp}</div>
              </div>
              <div class="warning">
                ⚠️ <strong>Security Notice:</strong> Never share this OTP with anyone. Our team will never ask for your OTP.
              </div>
              <p>If you didn't request this OTP, please ignore this email or contact our support team.</p>
              <p>Best regards,<br><strong>Phone Wraps Team</strong></p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Phone Wraps. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await sendMailWithTimeout(transporter, mailOptions);
    console.log('OTP email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending OTP email:', error);
    if (error && (error.code === 'ETIMEDOUT' || error.code === 'ECONNECTION' || error.code === 'EMAIL_SEND_TIMEOUT')) {
      console.error('SMTP connection failed. Check EMAIL_SMTP_HOST/PORT and outbound network access from deployment.');
    }
    if (error && error.code === 'EAUTH') {
      console.error('SMTP authentication failed. Verify EMAIL_USER and Gmail App Password in deployment env vars.');
    }
    throw new Error(`Failed to send OTP email: ${error.message}`);
  }
};

// Send password email (when randomly generated)
const sendPasswordEmail = async (email, password, username) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Phone Wraps" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your New Password - Phone Wraps',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .password-box { background: white; border: 2px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 8px; }
            .password-text { font-size: 24px; font-weight: bold; color: #667eea; font-family: monospace; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            .warning { background: #f8d7da; border-left: 4px solid #dc3545; padding: 10px; margin: 15px 0; }
            .info { background: #d1ecf1; border-left: 4px solid #0c5460; padding: 10px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎨 Phone Wraps</h1>
              <p>Welcome to Phone Wraps!</p>
            </div>
            <div class="content">
              <p>Hello <strong>${username}</strong>,</p>
              <p>Your account has been created successfully! Here are your login credentials:</p>
              
              <div class="password-box">
                <p style="margin: 0; color: #666;">Your Password:</p>
                <div class="password-text">${password}</div>
              </div>

              <div class="warning">
                🔐 <strong>Important:</strong> Please change your password after your first login for security purposes.
              </div>

              <div class="info">
                💡 <strong>Tip:</strong> You can change your password anytime from your account settings using OTP verification.
              </div>

              <p>You can now log in to your account at <a href="${process.env.FRONTEND_URL || 'https://phone-wraps.vercel.app'}">Phone Wraps</a></p>
              
              <p>Best regards,<br><strong>Phone Wraps Team</strong></p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Phone Wraps. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await sendMailWithTimeout(transporter, mailOptions);
    console.log('Password email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending password email:', error);
    throw new Error(`Failed to send password email: ${error.message}`);
  }
};

// Send password reset confirmation email
const sendPasswordResetConfirmation = async (email, username) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Phone Wraps" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Changed Successfully - Phone Wraps',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            .success-icon { font-size: 48px; }
            .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="success-icon">✅</div>
              <h1>Password Changed Successfully</h1>
            </div>
            <div class="content">
              <p>Hello <strong>${username}</strong>,</p>
              <p>Your password has been changed successfully.</p>
              <p>If you made this change, no further action is required.</p>
              
              <div class="warning">
                ⚠️ <strong>Didn't make this change?</strong> Please contact our support team immediately to secure your account.
              </div>

              <p>Best regards,<br><strong>Phone Wraps Team</strong></p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Phone Wraps. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await sendMailWithTimeout(transporter, mailOptions);
    console.log('Password reset confirmation sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending confirmation email:', error);
    // Don't throw error for confirmation emails - it's not critical
    return { success: false };
  }
};

module.exports = {
  sendOTPEmail,
  sendPasswordEmail,
  sendPasswordResetConfirmation
};
