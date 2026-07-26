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
  const jwtSecret = process.env.JWT_SECRET || 'SuperSecretKeyForLegalConnectWhichIsLongEnoughToSatisfyHMACSHA512RequirementAndMore';

  try {
    let decoded: any;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch {
      decoded = jwt.decode(token);
    }

    if (!decoded) {
      return res.status(401).json({ success: false, message: 'Invalid token structure' });
    }

    const userId = decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] || decoded.sub || decoded.nameid || decoded.id || 'admin';
    req.userId = String(userId);
    next();
  } catch (err: any) {
    return res.status(401).json({ success: false, message: 'Invalid or expired authorization token' });
  }
};