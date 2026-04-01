import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

// Admin JWT payload interface
export interface AdminJwtPayload {
  sub: string; // Admin ID
  email: string;
  type: 'admin'; // Token type to distinguish from user tokens
  iat?: number; // Issued at
  exp?: number; // Expiration time
}

// Extended payload for admin refresh tokens
export interface AdminRefreshTokenPayload extends AdminJwtPayload {
  tokenId: string; // Refresh token ID from database
  tokenType: 'refresh'; // Token sub-type for validation
}

// Token configuration
export interface TokenConfig {
  secret: string;
  expiresIn: string;
}

// JWT service for handling all admin JWT operations
@Injectable()
export class AdminJwtService {
  private readonly accessTokenConfig: TokenConfig;
  private readonly refreshTokenConfig: TokenConfig;

  constructor() {
    // Access token: short-lived (15 minutes)
    this.accessTokenConfig = {
      secret: process.env.JWT_ADMIN_SECRET || 'admin-access-secret-key',
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    };

    // Refresh token: long-lived (30 days)
    this.refreshTokenConfig = {
      secret:
        process.env.JWT_ADMIN_REFRESH_SECRET || 'admin-refresh-secret-key',
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    };
  }

  // Generate access token for admin
  generateAccessToken(payload: Omit<AdminJwtPayload, 'iat' | 'exp'>): string {
    const tokenPayload: AdminJwtPayload = {
      sub: payload.sub,
      email: payload.email,
      type: 'admin',
    };

    return jwt.sign(tokenPayload, this.accessTokenConfig.secret, {
      expiresIn: this.accessTokenConfig.expiresIn,
    });
  }

  // Generate refresh token for admin
  generateRefreshToken(
    payload: Omit<AdminRefreshTokenPayload, 'iat' | 'exp'>,
  ): string {
    const tokenPayload: AdminRefreshTokenPayload = {
      sub: payload.sub,
      email: payload.email,
      type: 'admin',
      tokenId: payload.tokenId,
      tokenType: 'refresh',
    };

    return jwt.sign(tokenPayload, this.refreshTokenConfig.secret, {
      expiresIn: this.refreshTokenConfig.expiresIn,
    });
  }

  // Verify access token
  verifyAccessToken(token: string): AdminJwtPayload {
    try {
      const payload = jwt.verify(
        token,
        this.accessTokenConfig.secret,
      ) as AdminJwtPayload;

      // Additional validation
      if (!payload.sub || !payload.email || payload.type !== 'admin') {
        throw new Error('Invalid admin access token payload');
      }

      return payload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Admin access token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid admin access token');
      }
      throw error;
    }
  }

  // Verify refresh token
  verifyRefreshToken(token: string): AdminRefreshTokenPayload {
    try {
      const payload = jwt.verify(
        token,
        this.refreshTokenConfig.secret,
      ) as AdminRefreshTokenPayload;

      // Additional validation
      if (
        !payload.sub ||
        !payload.email ||
        !payload.tokenId ||
        payload.type !== 'admin' ||
        payload.tokenType !== 'refresh'
      ) {
        throw new Error('Invalid admin refresh token payload');
      }

      return payload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Admin refresh token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid admin refresh token');
      }
      throw error;
    }
  }

  // Decode token without verification (for debugging)
  decodeToken<T = AdminJwtPayload | AdminRefreshTokenPayload>(
    token: string,
  ): T | null {
    try {
      return jwt.decode(token) as T;
    } catch {
      return null;
    }
  }

  // Extract token from Authorization header
  extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    return token.trim() || null;
  }

  // Get token expiration time
  getTokenExpiration(token: string): Date | null {
    try {
      const decoded = jwt.decode(token) as { exp?: number };
      if (decoded.exp) {
        return new Date(decoded.exp * 1000); // Convert to milliseconds
      }
      return null;
    } catch {
      return null;
    }
  }

  // Check if token is expired
  isTokenExpired(token: string): boolean {
    const expiration = this.getTokenExpiration(token);
    if (!expiration) return true;

    // Add 30 seconds buffer for network delays
    const now = new Date(Date.now() + 30000);
    return expiration < now;
  }
}
