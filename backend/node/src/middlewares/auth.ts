import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userRole?: string;
  sessionId?: string;
}

export const extractTokenFromRequest = (req: Request): string | undefined => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  } else if (req.headers.cookie) {
    const rawCookies = req.headers.cookie.split(';');
    for (const c of rawCookies) {
      const trimmed = c.trim();
      if (trimmed.startsWith('lc_admin_token=')) {
        return decodeURIComponent(trimmed.substring('lc_admin_token='.length));
      } else if (trimmed.startsWith('lc_token=')) {
        return decodeURIComponent(trimmed.substring('lc_token='.length));
      }
    }
  }
  return undefined;
};

export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const token = extractTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authorization token required' });
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error('CRITICAL: JWT_SECRET environment variable is not configured.');
    return res.status(500).json({ success: false, message: 'Server authentication configuration error.' });
  }

  try {
    const decoded: any = jwt.verify(token, jwtSecret);

    if (!decoded) {
      return res.status(401).json({ success: false, message: 'Invalid token structure' });
    }

    const userId = decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] || decoded.sub || decoded.nameid || decoded.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Token is missing user identity claim' });
    }
    req.userId = String(userId);
    req.userRole = decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || decoded.role;
    req.sessionId = decoded.SessionId || decoded.sessionId;
    next();
  } catch (err: any) {
    return res.status(401).json({ success: false, message: 'Invalid or expired authorization token' });
  }
};

export const optionalAuth = (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  const token = extractTokenFromRequest(req);
  if (!token) {
    return next();
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return next();
  }

  try {
    const decoded: any = jwt.verify(token, jwtSecret);
    if (decoded) {
      const userId = decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] || decoded.sub || decoded.nameid || decoded.id;
      if (userId) {
        req.userId = String(userId);
        req.userRole = decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || decoded.role;
        req.sessionId = decoded.SessionId || decoded.sessionId;
      }
    }
  } catch {
    // Gracefully ignore invalid or expired tokens on optional auth endpoints
  }

  next();
};