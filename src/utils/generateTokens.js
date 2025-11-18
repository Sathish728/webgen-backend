import jwt from 'jsonwebtoken'
import crypto from 'crypto'

//validate environment variables
const validateSecrets = () => {
    if(!process.env.JWT_SECRET_KEY || process.env.JWT_SECRET_KEY.length <32 ){
        throw new Error('JWT_SECRET_KEY must be at least 32 characters long');
    }
    if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET.length < 32) {
    throw new Error('JWT_REFRESH_SECRET must be at least 32 characters long');
    }
}

// Generate cryptographically secure random string
export const generateSecureSecret = (length = 64) => {
  return crypto.randomBytes(length).toString('base64');
};

export const generateAccessToken = (userId) => {
    validateSecrets()

    const payload = {
        userId: userId.toString(),
        type: 'access',
        iat: Math.floor(Date.now() / 1000),
    }

    const options = {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRY || '15m',
        issuer: process.env.JWT_ISSUER || 'your-app-name',
        audience: process.env.JWT_AUDIENCE || 'your-app-users',
        algorithm: 'HS256'
    }

    return jwt.sign(payload, process.env.JWT_SECRET_KEY, options)
}


export const generateRefreshToken = (userId) => {
    validateSecrets()

    const payload = {
        userId: userId.toString(),
        type: 'refresh',
        iat: Math.floor(Date.now() / 1000),
        jti:crypto.randomUUID(),
    }

     const options = {
        expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '7d',
        issuer: process.env.JWT_ISSUER || 'your-app-name',
        audience: process.env.JWT_AUDIENCE || 'your-app-users',
        algorithm: 'HS256'
  };

  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, options);
}


export  const verifyAccessToken = (token) => {
    validateSecrets()

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY, {
            issuer: process.env.JWT_ISSUER || 'your-app-name',
            audience: process.env.JWT_AUDIENCE || 'your-app-users',
            algorithms: ['HS256']
        })

        if(decoded.type !== 'access') {
             throw new Error("Invalid token type")
        }

        return { success: true, decoded }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

export const verifyRefreshToken = (token) => {
  validateSecrets();
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET, {
      issuer: process.env.JWT_ISSUER || 'your-app-name',
      audience: process.env.JWT_AUDIENCE || 'your-app-users',
      algorithms: ['HS256']
    });
    
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    
    return { success: true, decoded };
  } catch (error) {
    return { success: false, error: error.message };
  }
};