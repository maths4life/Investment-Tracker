import { Request, Response, NextFunction } from 'express';

// Extend express request to include user_id
declare global {
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  // Extract account identifier from header (x-user-id or Authorization bearer)
  const headerUserId = req.headers['x-user-id'] as string;
  const authHeader = req.headers.authorization;

  let userId = 'default-profile';

  if (headerUserId && headerUserId.trim()) {
    userId = headerUserId.trim();
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      // In master-key profile mode, token can be profile name or token
      userId = token;
    }
  }

  req.userId = userId;
  next();
}
