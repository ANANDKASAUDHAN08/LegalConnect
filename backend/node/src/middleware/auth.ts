import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authorization token required' });
  }

  const token = authHeader.split(' ')[1];
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    console.error('JWT_SECRET is not configured on the backend Node service');
    return res.status(500).json({ success: false, message: 'Server configuration error' });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as any;
    console.log('[DEBUG NODE AUTH] JWT validation succeeded. User ID:', decoded.sub || decoded.nameid || decoded.id || 'unknown');

    // Support standard .NET NameIdentifier claim URI and standard JWT 'sub' / 'nameid' claims
    const userId = decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] || decoded.sub || decoded.nameid || decoded.id;

    if (!userId) {
      console.warn('[DEBUG NODE AUTH] Token valid but missing user identity claims.');
      return res.status(401).json({ success: false, message: 'Invalid token structure' });
    }

    req.userId = String(userId);
    next();
  } catch (err: any) {
    console.error('[DEBUG NODE AUTH] JWT Verification failed:', err.message, 'Token used:', token.substring(0, 15) + '...');
    return res.status(401).json({ success: false, message: 'Invalid or expired authorization token' });
  }
};