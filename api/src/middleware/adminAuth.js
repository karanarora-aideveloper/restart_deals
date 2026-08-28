import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'shoppers_deals_jwt_secret_key_2026';

/**
 * Middleware to require Admin API Key or Admin JWT Token
 * Checks:
 * 1. x-admin-key header
 * 2. Authorization header (Bearer <ADMIN_API_KEY> or Bearer <JWT>)
 * 3. adminKey query param
 */
export function requireAdminAuth(req, res, next) {
  const configuredAdminKey = process.env.ADMIN_API_KEY;

  // Extract candidate key from headers or query
  const headerKey = req.headers['x-admin-key'];
  const authHeader = req.headers['authorization'];
  const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const queryKey = req.query?.adminKey;

  const candidateKey = headerKey || bearerToken || queryKey;

  // 1. Direct Admin API Key match
  if (configuredAdminKey && candidateKey === configuredAdminKey) {
    req.isAdmin = true;
    return next();
  }

  // 2. JWT Verification (if a JWT is passed in authorization header)
  if (bearerToken) {
    try {
      const decoded = jwt.verify(bearerToken, JWT_SECRET);
      if (decoded && (decoded.role === 'admin' || decoded.isAdmin === true || decoded.email?.endsWith('@shoppersdeals.in'))) {
        req.user = decoded;
        req.isAdmin = true;
        return next();
      }
    } catch (jwtErr) {
      // Not a valid JWT or expired, fall through to denial
    }
  }

  // 3. Development Fallback when ADMIN_API_KEY is not configured
  if (!configuredAdminKey && process.env.NODE_ENV !== 'production') {
    // In local development without configured key, allow with warning
    console.warn('[AdminAuth Warning] ADMIN_API_KEY is not set in environment. Allowing request in development mode.');
    req.isAdmin = true;
    return next();
  }

  return res.status(401).json({
    success: false,
    error: 'Unauthorized: Admin authentication required. Provide x-admin-key header or valid admin token.'
  });
}
