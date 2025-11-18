import { verifyAccessToken } from "../utils/generateTokens.js"
import User from "../models/User.js";

export const protectRoute = async(req, res, next) => {
    try {
        let token = null

        // 1. Try to get token from Authorization header (Preferred for mobile/API)
        const authHeader = req.headers.authorization || req.headers.Authorization
        if(authHeader && authHeader.startsWith("Bearer")){
            token = authHeader.split(" ")[1]
        }

         // 2. If no header token, try cookies (for web browsers)
         if(!token && req.cookies?.accessToken){
            token = req.cookies.accessToken
         }

         // 3. If still no token -> reject
         if(!token){
            return res.status(401).json({ 
            success: false,
            message: "Access denied. No authentication token provided.",
            code: "NO_TOKEN"
          })
         }

         // 4. Verify token using utility function (enhanced security)
         let decoded
         const tokenResult = verifyAccessToken(token)

         if(!tokenResult.success){
         if(tokenResult.error.includes('expired')){
            return res.status(401).json({ 
                success: false,
                message: "Access token has expired. Please refresh your token.",
                code: "TOKEN_EXPIRED"
            });
         }else if (tokenResult.error.includes('invalid')) {
            return res.status(401).json({ 
                success: false,
                message: "Invalid authentication token.",
                code: "INVALID_TOKEN"
            });
      } else {
            return res.status(401).json({ 
                success: false,
                message: "Token verification failed.",
                code: "TOKEN_VERIFICATION_FAILED"
            });
      }
         }

         decoded = tokenResult.decoded
   
    // 5. Validate token payload
    if (!decoded.userId) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid token payload.",
        code: "INVALID_PAYLOAD"
      });
    }

    // 6. Find user in database
    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: "User associated with this token no longer exists.",
        code: "USER_NOT_FOUND"
      });
    }

    // 7. Check if user account is active (optional - add status field to User model)
    if (user.status === 'suspended' || user.status === 'inactive') {
      return res.status(403).json({ 
        success: false,
        message: "Your account has been suspended. Please contact support.",
        code: "ACCOUNT_SUSPENDED"
      });
    }

    // 8. Check token type (ensure it's an access token)
    if (decoded.type !== 'access') {
      return res.status(401).json({ 
        success: false,
        message: "Invalid token type. Access token required.",
        code: "WRONG_TOKEN_TYPE"
      });
    }

    // 9. Attach user to request object
    req.user = user;
    req.token = token;
    req.tokenData = decoded;
    
    // 10. Continue to next middleware
    next();

  } catch (error) {
    console.error("Authentication Error:", error);
    return res.status(500).json({ 
      success: false,
      message: "Internal server error during authentication.",
      code: "AUTH_ERROR"
    });
  }
}



// Security headers middleware
export const securityHeaders = (req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy (basic)
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  
  next();
};


// Middleware to log authentication events
export const logAuthEvent = (event, additionalData = {}) => {
  return (req, res, next) => {
    const logData = {
      event,
      userId: req.user?.id,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString(),
      ...additionalData
    };
    
    console.log('Auth Event:', JSON.stringify(logData));
    // In production, send to logging service (like Winston, LogRocket, etc.)
    
    next();
  };
};


// Admin only middleware
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false,
      message: "Authentication required" 
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false,
      message: "Admin access required" 
    });
  }

  next();
};

// Middleware for soft authentication (user is optional)
export const optionalAuth = async (req, res, next) => {
  try {
    let token = null;

    // Try to get token
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    // If no token, continue without user
    if (!token) {
      req.user = null;
      return next();
    }

    // Try to verify token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      const user = await User.findById(decoded.userId).select("-password");
      req.user = user;
    } catch (error) {
      // If token is invalid, continue without user
      req.user = null;
    }

    next();
  } catch (error) {
    console.error("Optional Auth Error:", error);
    req.user = null;
    next();
  }
};