
import nodemailer from 'nodemailer';

// Create transporter with email service configuration
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD, // App password for Gmail
    },
  });
};



// Send verification email with OTP
export const sendVerificationEmail = async (email, otp, fullName) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Streamify" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify Your Email - Streamify',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              line-height: 1.6; 
              color: #333; 
              background-color: #f4f4f4;
              margin: 0;
              padding: 0;
            }
            .container { 
              max-width: 600px; 
              margin: 20px auto; 
              background: white;
              border-radius: 10px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .header { 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
              padding: 40px 30px; 
              text-align: center; 
            }
            .header h1 { 
              color: white; 
              margin: 0; 
              font-size: 32px;
              font-weight: 600;
            }
            .content { 
              padding: 40px 30px; 
            }
            .greeting {
              font-size: 18px;
              font-weight: 600;
              margin-bottom: 20px;
              color: #333;
            }
            .message {
              font-size: 15px;
              color: #666;
              margin-bottom: 30px;
              line-height: 1.8;
            }
            .otp-box { 
              background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
              border: 2px dashed #667eea; 
              border-radius: 12px; 
              padding: 30px 20px; 
              text-align: center; 
              margin: 30px 0; 
            }
            .otp-label {
              font-size: 14px;
              color: #666;
              margin-bottom: 15px;
              font-weight: 500;
            }
            .otp-code { 
              font-size: 42px; 
              font-weight: bold; 
              color: #667eea; 
              letter-spacing: 12px;
              font-family: 'Courier New', monospace;
            }
            .expiry-notice {
              background: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
              font-size: 14px;
              color: #856404;
            }
            .footer { 
              background: #f9f9f9;
              text-align: center; 
              padding: 30px;
              color: #666; 
              font-size: 13px;
              border-top: 1px solid #eee;
            }
            .footer p {
              margin: 5px 0;
            }
            .security-notice {
              font-size: 13px;
              color: #999;
              margin-top: 20px;
              padding-top: 20px;
              border-top: 1px solid #eee;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚢 Streamify</h1>
            </div>
            <div class="content">
              <div class="greeting">Hi ${fullName},</div>
              <div class="message">
                Welcome to Streamify! We're excited to have you join our community of language learners.
                <br><br>
                To complete your registration and verify your email address, please use the verification code below:
              </div>
              
              <div class="otp-box">
                <div class="otp-label">Your Verification Code</div>
                <div class="otp-code">${otp}</div>
              </div>
              
              <div class="expiry-notice">
                <strong>⏰ Important:</strong> This code will expire in 10 minutes for security reasons.
              </div>
              
              <div class="security-notice">
                If you didn't create an account with Streamify, please ignore this email. 
                Your security is important to us.
              </div>
            </div>
            <div class="footer">
              <p><strong>Streamify</strong> - Connect with Language Partners Worldwide</p>
              <p>© ${new Date().getFullYear()} Streamify. All rights reserved.</p>
              <p style="margin-top: 10px;">This is an automated email. Please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Verification email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending verification email:', error);
    return { success: false, error: error.message };
  }
};

// Send password reset email with OTP
export const sendPasswordResetEmail = async (email, otp, fullName) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Streamify" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Reset Your Password - Streamify',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              line-height: 1.6; 
              color: #333; 
              background-color: #f4f4f4;
              margin: 0;
              padding: 0;
            }
            .container { 
              max-width: 600px; 
              margin: 20px auto; 
              background: white;
              border-radius: 10px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .header { 
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); 
              padding: 40px 30px; 
              text-align: center; 
            }
            .header h1 { 
              color: white; 
              margin: 0; 
              font-size: 32px;
              font-weight: 600;
            }
            .content { 
              padding: 40px 30px; 
            }
            .greeting {
              font-size: 18px;
              font-weight: 600;
              margin-bottom: 20px;
              color: #333;
            }
            .message {
              font-size: 15px;
              color: #666;
              margin-bottom: 30px;
              line-height: 1.8;
            }
            .otp-box { 
              background: linear-gradient(135deg, #f093fb15 0%, #f5576c15 100%);
              border: 2px dashed #f5576c; 
              border-radius: 12px; 
              padding: 30px 20px; 
              text-align: center; 
              margin: 30px 0; 
            }
            .otp-label {
              font-size: 14px;
              color: #666;
              margin-bottom: 15px;
              font-weight: 500;
            }
            .otp-code { 
              font-size: 42px; 
              font-weight: bold; 
              color: #f5576c; 
              letter-spacing: 12px;
              font-family: 'Courier New', monospace;
            }
            .warning { 
              background: #fff3cd; 
              border-left: 4px solid #ffc107; 
              padding: 20px; 
              margin: 25px 0;
              border-radius: 4px;
            }
            .warning-title {
              font-weight: 600;
              color: #856404;
              margin-bottom: 8px;
              font-size: 15px;
            }
            .warning-text {
              color: #856404;
              font-size: 14px;
              line-height: 1.6;
            }
            .footer { 
              background: #f9f9f9;
              text-align: center; 
              padding: 30px;
              color: #666; 
              font-size: 13px;
              border-top: 1px solid #eee;
            }
            .footer p {
              margin: 5px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔒 Password Reset</h1>
            </div>
            <div class="content">
              <div class="greeting">Hi ${fullName},</div>
              <div class="message">
                We received a request to reset the password for your Streamify account.
                <br><br>
                Use the verification code below to proceed with resetting your password:
              </div>
              
              <div class="otp-box">
                <div class="otp-label">Your Reset Code</div>
                <div class="otp-code">${otp}</div>
              </div>
              
              <div class="warning">
                <div class="warning-title">⚠️ Security Notice</div>
                <div class="warning-text">
                  This code will expire in 10 minutes. If you didn't request a password reset, 
                  please ignore this email and ensure your account is secure. 
                  Your password will remain unchanged.
                </div>
              </div>
            </div>
            <div class="footer">
              <p><strong>Streamify</strong> - Secure Account Recovery</p>
              <p>© ${new Date().getFullYear()} Streamify. All rights reserved.</p>
              <p style="margin-top: 10px;">This is an automated email. Please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return { success: false, error: error.message };
  }
};

// Send welcome email after successful verification
export const sendWelcomeEmail = async (email, fullName) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Streamify" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Welcome to Streamify! 🎉',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              line-height: 1.6; 
              color: #333; 
              background-color: #f4f4f4;
              margin: 0;
              padding: 0;
            }
            .container { 
              max-width: 600px; 
              margin: 20px auto; 
              background: white;
              border-radius: 10px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .header { 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
              padding: 40px 30px; 
              text-align: center; 
            }
            .header h1 { 
              color: white; 
              margin: 0; 
              font-size: 36px;
              font-weight: 600;
            }
            .content { 
              padding: 40px 30px; 
            }
            .greeting {
              font-size: 20px;
              font-weight: 600;
              margin-bottom: 20px;
              color: #333;
            }
            .message {
              font-size: 15px;
              color: #666;
              margin-bottom: 30px;
              line-height: 1.8;
            }
            .features {
              margin: 30px 0;
            }
            .feature { 
              background: #f9f9f9; 
              padding: 20px; 
              margin: 15px 0; 
              border-radius: 8px; 
              border-left: 4px solid #667eea;
            }
            .feature-title {
              font-weight: 600;
              font-size: 16px;
              color: #333;
              margin-bottom: 8px;
            }
            .feature-text {
              font-size: 14px;
              color: #666;
              line-height: 1.6;
            }
            .cta-section {
              text-align: center;
              margin: 30px 0;
              padding: 30px;
              background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
              border-radius: 8px;
            }
            .cta-text {
              font-size: 16px;
              color: #333;
              margin-bottom: 20px;
            }
            .footer { 
              background: #f9f9f9;
              text-align: center; 
              padding: 30px;
              color: #666; 
              font-size: 13px;
              border-top: 1px solid #eee;
            }
            .footer p {
              margin: 5px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Welcome!</h1>
            </div>
            <div class="content">
              <div class="greeting">Hi ${fullName},</div>
              <div class="message">
                Congratulations! Your email has been verified successfully. 
                Welcome to Streamify – where language learners connect, practice, and grow together!
              </div>
              
              <div class="features">
                <h3 style="color: #333; margin-bottom: 20px;">What's Next?</h3>
                
                <div class="feature">
                  <div class="feature-title">📝 Complete Your Profile</div>
                  <div class="feature-text">
                    Tell us about your language learning journey, native language, 
                    and what you're looking to learn. This helps us connect you with the perfect partners.
                  </div>
                </div>
                
                <div class="feature">
                  <div class="feature-title">🌍 Find Language Partners</div>
                  <div class="feature-text">
                    Discover people from around the world who want to learn your native language 
                    while helping you practice theirs.
                  </div>
                </div>
                
                <div class="feature">
                  <div class="feature-title">💬 Start Conversations</div>
                  <div class="feature-text">
                    Begin chatting with your matches in real-time. Practice speaking, 
                    improve your skills, and make lasting friendships.
                  </div>
                </div>
                
                <div class="feature">
                  <div class="feature-title">📞 Video & Voice Calls</div>
                  <div class="feature-text">
                    Take your practice to the next level with built-in video and voice calling. 
                    Immerse yourself in real conversations.
                  </div>
                </div>
              </div>
              
              <div class="cta-section">
                <div class="cta-text">
                  <strong>Ready to start your journey?</strong><br>
                  Log in to Streamify and complete your profile to get matched with language partners!
                </div>
              </div>
              
              <div class="message" style="margin-top: 30px;">
                Thank you for joining our community. We're excited to be part of your language learning adventure!
                <br><br>
                <strong>Happy learning! 🚀</strong>
              </div>
            </div>
            <div class="footer">
              <p><strong>Streamify</strong> - Connect with Language Partners Worldwide</p>
              <p>© ${new Date().getFullYear()} Streamify. All rights reserved.</p>
              <p style="margin-top: 15px;">
                Need help? Contact us at support@streamify.com
              </p>
              <p style="margin-top: 10px;">This is an automated email. Please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Welcome email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return { success: false, error: error.message };
  }
};

// Optional: Test email connection
export const testEmailConnection = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('✅ Email service is ready to send emails');
    return { success: true };
  } catch (error) {
    console.error('❌ Email service connection failed:', error);
    return { success: false, error: error.message };
  }
};