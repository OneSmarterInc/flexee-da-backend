import { Injectable, NestMiddleware } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET;

@Injectable()
export class AuthenticateTokenMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    // Check for Bearer token in Authorization header or token header
    let token = req.headers['token'];
    
    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Auth token is not provided',
      });
    }
    if (!JWT_SECRET || typeof JWT_SECRET !== 'string') {
      return res.status(500).json({
        success: false,
        message: 'JWT secret is not configured properly',
      });
    }
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({
            success: false,
            message: 'Session expired. Please log in again.',
            reason: 'token_expired',
          });
        }
        return res.status(403).json({
          success: false,
          message: 'Unauthorized user',
        });
      }
      req.user = user;
      next();
    });
  }
}