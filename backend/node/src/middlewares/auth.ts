import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userRole?: string;
  sessionId?: string;
}

export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  let token: string | undefined;

  // 1. Prefer Authorization Bearer header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.headers.cookie) {
    // 2. Cookie fallback for cross-origin / SPA requests
    const rawCookies = req.headers.cookie.split(';');
    for (const c of rawCookies) {
      const trimmed = c.trim();
      if (trimmed.startsWith('lc_admin_token=')) {
        token = decodeURIComponent(trimmed.substring('lc_admin_token='.length));
        break;
      } else if (trimmed.startsWith('lc_token=')) {
        token = decodeURIComponent(trimmed.substring('lc_token='.length));
      }
    }
  }

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