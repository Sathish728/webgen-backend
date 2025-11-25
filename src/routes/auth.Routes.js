import express from 'express'
import { logAuthEvent, protectRoute, securityHeaders } from '../middleware/auth.middleware.js'
import { forgotPassword, getCurrentUser, logIn, logOut, refreshAccessToken, resendVerificationOTP, resetPassword, signUp, verifyEmailOTP, verifyResetOTP } from '../controllers/auth.controller.js';


const router = express.Router()

// Apply security headers to all auth routes
router.use(securityHeaders)

// ================== PUBLIC ROUTES (No Authentication Required) ==================

/**
 * @route   POST /api/auth/signup
 * @desc    Register a new user and send verification email
 * @access  Public
 * @body    { email, password, fullName }
 */
router.post("/signup",                     
  logAuthEvent('signup_attempt'),
  signUp
);

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verify user email with OTP code
 * @access  Public
 * @body    { email, otp }
 */
router.post("/verify-email",
  logAuthEvent('email_verification_attempt'),
  verifyEmailOTP
);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend verification OTP to user email
 * @access  Public
 * @body    { email }
 */
router.post("/resend-verification",
  logAuthEvent('resend_verification_attempt'),
  resendVerificationOTP
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user (requires verified email)
 * @access  Public
 * @body    { email, password }
 */
router.post("/login", 
  logAuthEvent('login_attempt'),
  logIn
);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset OTP
 * @access  Public
 * @body    { email }
 */
router.post("/forgot-password",
  logAuthEvent('forgot_password_attempt'),
  forgotPassword
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password using OTP
 * @access  Public
 * @body    { email, otp, newPassword }
 */
router.post("/reset-password",
  logAuthEvent('reset_password_attempt'),
  resetPassword
);


/**
 * @route   POST /api/auth/verify-reset-otp
 * @desc    Verify password reset OTP (without resetting password yet)
 * @access  Public
 * @body    { email, otp }
 */
router.post("/verify-reset-otp",
  logAuthEvent('verify_reset_otp_attempt'),
  verifyResetOTP
);


/**
 * @route   POST /api/auth/logout
 * @desc    Logout user and clear cookies
 * @access  Public (but can be called by authenticated users)
 */
router.post("/logout", 
  logAuthEvent('logout_attempt'),
  logOut
);


/**
 * @route   GET /api/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public (uses refresh token from cookie)
 */
router.get("/refresh", 
  logAuthEvent('token_refresh_attempt'),
  refreshAccessToken
);

/**
 * @route   GET /api/auth/health
 * @desc    Health check endpoint
 * @access  Public
 */
router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Auth service is healthy",
    timestamp: new Date().toISOString(),
    service: "authentication"
  });
});


// ================== PROTECTED ROUTES (Authentication Required) ==================
/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user
 * @access  Protected
 * @headers Authorization: Bearer <access_token>
 */
router.get("/me", 
  protectRoute,                            // Requires valid access token
  logAuthEvent('profile_access'),
  getCurrentUser
);


// ================== ERROR HANDLING ==================
/**
 * Catch-all route for undefined endpoints
 */
router.all('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Auth route ${req.method} ${req.originalUrl} not found`,
    availableRoutes: {
      public: [
        'POST /api/auth/signup - Register new user',
        'POST /api/auth/verify-email - Verify email with OTP',
        'POST /api/auth/resend-verification - Resend verification OTP',
        'POST /api/auth/login - Login user',
        'POST /api/auth/forgot-password - Request password reset',
        'POST /api/auth/reset-password - Reset password with OTP',
        'POST /api/auth/logout - Logout user',
        'GET  /api/auth/refresh - Refresh access token',
        'GET  /api/auth/health - Service health check',
      ],
      protected: [
        'GET  /api/auth/me - Get current user (requires auth)',
        'POST /api/auth/onboarding - Complete profile (requires auth)',
      ]
    }
  });
});

export default router;