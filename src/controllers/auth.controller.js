import { generateAccessToken, generateRefreshToken } from "../utils/generateTokens.js";
import User from '../models/User.js'
import jwt from 'jsonwebtoken'
import rateLimit from "express-rate-limit";
import validator from "validator";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { sendPasswordResetEmail, sendVerificationEmail, sendWelcomeEmail } from "../lib/emailService.js";

// Helper function to sanitize input
const sanitizeInput = (input) => {
    if(typeof input ===  'string' ){
        return validator.escape(input.trim())
    }

    return input
}

// Helper function to validate password strength
const validatePassword = (password) => {
    const minLength = 8
    const hasUpperCase = /[A-Z]/.test(password)
    const hasLowerCase = /[a-z]/.test(password)
    const hasNumbers = /\d/.test(password)
    const hasNonalphas = /\W/.test(password)

    if(password.length < minLength){
        return { vali: false, message: "Password must be at least 8 characters long" }
    }

    if (!hasUpperCase) {
    return { valid: false, message: "Password must contain at least one uppercase letter" };
  }
  if (!hasLowerCase) {
    return { valid: false, message: "Password must contain at least one lowercase letter" };
  }
  if (!hasNumbers) {
    return { valid: false, message: "Password must contain at least one number" };
  }
  if (!hasNonalphas) {
    return { valid: false, message: "Password must contain at least one special character" };
  }
  
  return { valid: true };
}

// Helper function to set secure cookies
const setSecureCookie = (res, name, value, maxAge = 7 * 24 * 60 * 60 * 1000) => {
  res.cookie(name, value, {
    maxAge,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    path: "/",
  });
};

// Helper function to generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};


export async function signUp(req,res) {
    let { email, password, fullName } = req.body;
    try {
        // Sanitize inputs
        email = sanitizeInput(email)
        fullName = sanitizeInput(fullName)

        //validation
        if(!email || !password || !fullName) {
            return res.status(400).json({
                success: false,
                message: "All fields are required" 
            })
        }

        //validate email
        if(!validator.isEmail(email)) {
          return res.status(400).json({ 
            success: false,
            message: "Invalid email format" 
      });
        }

        //Normalize email
        email = validator.normalizeEmail(email)

        // Validate password strength
        const passwordValidation = validatePassword(password)
          if (!passwordValidation.valid) {
            return res.status(400).json({ 
                success: false,
                message: passwordValidation.message 
        });
        }

         // Validate full name
         if(fullName.length < 2 ||fullName.length > 50 ) {
          return res.status(400).json({ 
            success: false,
            message: "Full name must be between 2 and 50 characters" 
      });
         }

         // Check if user already exists
         const existingUser = await User.findOne({email})
         if(existingUser) {
            return res.status(409).json({
                success: false,
                message: "User with this email already exists"
            })
         }

         // Hash password before saving
         const saltRounds = 12
         const hashedPassword = await bcrypt.hash(password, saltRounds)

         // Generate OTP
         const otp = generateOTP()
         const otpExpiry = new Date(Date.now() + 10 * 60 * 1000) //10mins

         //create new user
         const newUser = await User.create({
            email,
            password: hashedPassword,
            fullName,
            emailVerificationToken: otp,
            emailVerificationExpires: otpExpiry,
            isEmailVerified: false,
            createdAt: new Date()
         })

         //send verification email
         const emailResult = await sendVerificationEmail(email, otp, fullName)
         if(!emailResult){
            console.error('Failed to send verification email:', emailResult.error);
            }

         

        // Remove password from response
        const userResponse = {
            _id: newUser._id,
            email: newUser.email,
            fullName: newUser.fullName,
            isEmailVerified: newUser.isEmailVerified,
            createdAt: newUser.createdAt,
        }

        res.status(201).json({
            success: true, 
            user: userResponse, 
            message: "Account created successfully. Please check your email for verification code.",
            requiresVerification: true
        })
    } catch (error) {
        console.error("Error in signup controller:", error);
    
        // Don't expose internal errors to client
        res.status(500).json({ 
        success: false,
        message: "Internal server error. Please try again later." 
        });
    }
}

//verify email

export async function verifyEmailOTP(req, res) {
    try {
        // Log the entire request body
        console.log('=== VERIFY EMAIL REQUEST ===');
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        console.log('Request headers:', req.headers['content-type']);
        
        let { email, otp } = req.body;

        console.log('Extracted values:', { email, otp });
        console.log('Email type:', typeof email);
        console.log('OTP type:', typeof otp);

        // Validate input exists first
        if (!email || !otp) {
            console.log('Missing email or OTP');
            return res.status(400).json({
                success: false,
                message: "Email and OTP are required",
                received: { email: !!email, otp: !!otp }
            });
        }

        // Handle if email comes as object
        if (typeof email === "object" && email !== null) {
            console.log('Email is an object, extracting email property');
            email = email.email;
        }

        // Validate email format
        if (typeof email !== "string") {
            console.log('Email is not a string:', typeof email);
            return res.status(400).json({ 
                success: false,
                message: "Invalid email format" 
            });
        }

        // Sanitize and normalize
        email = sanitizeInput(email);
        console.log('After sanitizeInput:', email);
        
        email = validator.normalizeEmail(email);
        console.log('After normalizeEmail:', email);
        
        // Sanitize OTP and trim whitespace
        otp = sanitizeInput(otp).trim();
        console.log('After sanitizing OTP:', otp);

        // Validate OTP format (should be 6 digits)
        if (!/^\d{6}$/.test(otp)) {
            console.log('Invalid OTP format:', otp);
            return res.status(400).json({
                success: false,
                message: "Invalid OTP format. Must be 6 digits."
            });
        }

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            console.log(`Verification attempt for non-existent user: ${email}`);
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        console.log('User found:', {
            email: user.email,
            isVerified: user.isEmailVerified,
            hasToken: !!user.emailVerificationToken,
            tokenExpires: user.emailVerificationExpires
        });

        // Check if already verified
        if (user.isEmailVerified) {
            console.log('Email already verified');
            return res.status(400).json({
                success: false,
                message: "Email is already verified"
            });
        }

        // Check if verification token exists
        if (!user.emailVerificationToken || !user.emailVerificationExpires) {
            console.log('No verification token found');
            return res.status(400).json({
                success: false,
                message: "No verification token found. Please request a new one."
            });
        }

        // Check if token expired
        const now = new Date();
        const expires = user.emailVerificationExpires;
        console.log('Token expiry check:', {
            now: now.toISOString(),
            expires: expires.toISOString(),
            expired: now > expires
        });

        if (now > expires) {
            console.log('Token has expired');
            return res.status(400).json({
                success: false,
                message: "Verification code has expired. Please request a new one."
            });
        }

        // Check verification attempts (max 5)
        if (user.verificationAttempts >= 5) {
            console.log('Too many attempts:', user.verificationAttempts);
            return res.status(429).json({
                success: false,
                message: "Too many verification attempts. Please request a new code."
            });
        }

        // Compare OTP (ensure both are strings and trimmed)
        const storedOtp = String(user.emailVerificationToken).trim();
        const providedOtp = String(otp).trim();

        console.log('=== OTP COMPARISON ===');
        console.log('Stored OTP:', storedOtp);
        console.log('Provided OTP:', providedOtp);
        console.log('Match:', storedOtp === providedOtp);
        console.log('Stored length:', storedOtp.length);
        console.log('Provided length:', providedOtp.length);

        if (storedOtp !== providedOtp) {
            user.verificationAttempts = (user.verificationAttempts || 0) + 1;
            user.lastVerificationAttempt = new Date();
            await user.save();

            console.log(`Invalid OTP attempt for ${email}. Attempts: ${user.verificationAttempts}`);

            return res.status(400).json({
                success: false,
                message: "Invalid verification code",
                attemptsRemaining: Math.max(0, 5 - user.verificationAttempts)
            });
        }

        // Verification successful
        console.log('✅ Verification successful!');
        
        user.isEmailVerified = true;
        user.emailVerificationToken = null;
        user.emailVerificationExpires = null;
        user.verificationAttempts = 0;
        user.lastVerificationAttempt = null;
        await user.save();

        console.log(`Email verified successfully for: ${email}`);

        // Send welcome email (async, don't wait)
        sendWelcomeEmail(user.email, user.fullName).catch(error => {
            console.error('Failed to send welcome email:', error);
        });

        // Generate tokens
        const accessToken = generateAccessToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        // Set refresh token in secure cookie
        setSecureCookie(res, "refreshToken", refreshToken);

        const userResponse = {
            _id: user._id,
            email: user.email,
            fullName: user.fullName,
            isEmailVerified: user.isEmailVerified,
        };

        res.status(200).json({
            success: true,
            user: userResponse,
            accessToken,
            message: "Email verified successfully!"
        });

    } catch (error) {
        console.error("❌ Error in verify email OTP:", error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({
            success: false,
            message: "Internal server error. Please try again later."
        });
    }
}

// ---------------- RESEND VERIFICATION OTP ----------------
export async function resendVerificationOTP(req, res) {
  try {
    let { email } = req.body;

    email = sanitizeInput(email);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format"
      });
    }

    email = validator.normalizeEmail(email);

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified"
      });
    }

    // Check rate limiting
    if (user.lastVerificationAttempt) {
      const timeSinceLastAttempt = Date.now() - user.lastVerificationAttempt.getTime();
      if (timeSinceLastAttempt < 60 * 1000) { // 1 minute
        return res.status(429).json({
          success: false,
          message: "Please wait before requesting a new code",
          retryAfter: Math.ceil((60 * 1000 - timeSinceLastAttempt) / 1000)
        });
      }
    }

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    user.emailVerificationToken = otp;
    user.emailVerificationExpires = otpExpiry;
    user.lastVerificationAttempt = new Date();
    await user.save();

    const emailResult = await sendVerificationEmail(email, otp, user.fullName);

    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to send verification email. Please try again."
      });
    }

    res.status(200).json({
      success: true,
      message: "Verification code sent successfully. Please check your email."
    });

  } catch (error) {
    console.error("Error in resend verification OTP:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later."
    });
  }
}


// ---------------- FORGOT PASSWORD ----------------
export async function forgotPassword(req, res) {
  try {
    let { email } = req.body;

    email = sanitizeInput(email);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format"
      });
    }

    email = validator.normalizeEmail(email);

    const user = await User.findOne({ email });

    // Don't reveal if user exists or not (security)
    if (!user) {
      return res.status(200).json({
        success: true,
        message: "If an account exists with this email, you will receive a password reset code."
      });
    }

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    user.passwordResetToken = otp;
    user.passwordResetExpires = otpExpiry;
    await user.save();

    const emailResult = await sendPasswordResetEmail(email, otp, user.fullName);

    if (!emailResult.success) {
      console.error('Failed to send password reset email:', emailResult.error);
    }

    res.status(200).json({
      success: true,
      message: "If an account exists with this email, you will receive a password reset code."
    });

  } catch (error) {
    console.error("Error in forgot password:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later."
    });
  }
}


// ---------------- RESET PASSWORD ----------------
export async function resetPassword(req, res) {
  try {
    let { email, otp, newPassword } = req.body;

    email = sanitizeInput(email);
    otp = sanitizeInput(otp);

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    email = validator.normalizeEmail(email);

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        message: passwordValidation.message
      });
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset code"
      });
    }

    if (!user.passwordResetToken || !user.passwordResetExpires) {
      return res.status(400).json({
        success: false,
        message: "No reset request found. Please request a password reset."
      });
    }

    if (new Date() > user.passwordResetExpires) {
      return res.status(400).json({
        success: false,
        message: "Reset code has expired. Please request a new one."
      });
    }

    if (user.passwordResetToken !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid reset code"
      });
    }

    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    user.password = hashedPassword;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password reset successfully. You can now login with your new password."
    });

  } catch (error) {
    console.error("Error in reset password:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later."
    });
  }
}



// ---------------- VERIFY RESET OTP (Without resetting password) ----------------
export async function verifyResetOTP(req, res) {
  try {
    let { email, otp } = req.body;

    email = sanitizeInput(email);
    otp = sanitizeInput(otp);

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required"
      });
    }

    email = validator.normalizeEmail(email);

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset code"
      });
    }

    if (!user.passwordResetToken || !user.passwordResetExpires) {
      return res.status(400).json({
        success: false,
        message: "No reset request found. Please request a password reset."
      });
    }

    if (new Date() > user.passwordResetExpires) {
      return res.status(400).json({
        success: false,
        message: "Reset code has expired. Please request a new one."
      });
    }

    if (user.passwordResetToken !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid reset code"
      });
    }

    // OTP is valid - don't clear it yet, user still needs to reset password
    res.status(200).json({
      success: true,
      message: "OTP verified successfully. You can now reset your password."
    });

  } catch (error) {
    console.error("Error in verify reset OTP:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later."
    });
  }
}


// ---------------- LOGIN ----------------
export async function logIn(req, res) {
  try {
    let { email, password } = req.body;

    email = sanitizeInput(email);

    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: "Email and password are required" 
      });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid email format" 
      });
    }

    email = validator.normalizeEmail(email);

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid email or password" 
      });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid email or password" 
      });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      // AUTO-RESEND OTP if expired or doesn't exist
      const needsNewOTP = !user.emailVerificationToken || 
                          !user.emailVerificationExpires || 
                          new Date() > user.emailVerificationExpires;

      if (needsNewOTP) {
        const otp = generateOTP();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

        user.emailVerificationToken = otp;
        user.emailVerificationExpires = otpExpiry;
        await user.save();

        // Send new OTP
         const emailResult = await sendVerificationEmail(email, otp, )
         if(!emailResult){
            console.error('Failed to send verification email:', emailResult.error);
            }
      }
 

      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in. A verification code has been sent to your email.",
        requiresVerification: true,
        email: user.email
      });
    }

    user.lastLogin = new Date();
    await user.save();

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    setSecureCookie(res, "refreshToken", refreshToken);

    const userResponse = {
      _id: user._id,
      email: user.email,
      fullName: user.fullName,
      isEmailVerified: user.isEmailVerified,
      lastLogin: user.lastLogin,
    };

    res.status(200).json({ 
      success: true, 
      user: userResponse, 
      accessToken,
      message: "Login successful"
    });

  } catch (error) {
    console.error("Error in login controller:", error);
    res.status(500).json({ 
      success: false,
      message: "Internal server error. Please try again later." 
    });
  }
}

// ---------------- LOGOUT ----------------
export function logOut(req, res) {
  try {
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      path: "/",
    });

    res.status(200).json({ 
      success: true, 
      message: "Logout successful" 
    });
  } catch (error) {
    console.error("Error in logout controller:", error);
    res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
}

// ---------------- REFRESH TOKEN ----------------
export async function refreshAccessToken(req, res) {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ 
        success: false,
        message: "No refresh token provided" 
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (error) {
      res.clearCookie("refreshToken");
      return res.status(401).json({ 
        success: false,
        message: "Invalid or expired refresh token" 
      });
    }

    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      res.clearCookie("refreshToken");
      return res.status(401).json({ 
        success: false,
        message: "User not found" 
      });
    }

    const accessToken = generateAccessToken(user._id);

    res.json({ 
      success: true, 
      accessToken,
      user: {
        _id: user._id,
        email: user.email,
        fullName: user.fullName,
        profilePic: user.profilePic,
        isOnBoarded: user.isOnBoarded || false,
        isEmailVerified: user.isEmailVerified || false,
      }
    });

  } catch (error) {
    console.error("Error in refresh token controller:", error);
    res.clearCookie("refreshToken");
    res.status(401).json({ 
      success: false,
      message: "Invalid or expired refresh token" 
    });
  }
}


// ---------------- GET CURRENT USER ----------------
export async function getCurrentUser(req, res) {
  try {
    const user = await User.findById(req.user._id).select("-password");
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    console.error("Error getting current user:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
}

