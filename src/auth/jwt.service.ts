import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

// JWT payload interface
export interface JwtPayload {
  sub: string; // User ID
  email: string;
  iat?: number; // Issued at
  exp?: number; // Expiration time
}

// Extended payload for refresh tokens
export interface RefreshTokenPayload extends JwtPayload {
  tokenId: string; // Refresh token ID from database
  type: 'refresh'; // Token type for validation
}

// Token configuration
export interface TokenConfig {
  secret: string;
  expiresIn: string;
}

// JWT service for handling all JWT operations without Passport
@Injectable()
export class JwtService {
  private readonly accessTokenConfig: TokenConfig;
  private readonly refreshTokenConfig: TokenConfig;

  constructor() {
    // Access token: short-lived (15 minutes)
    this.accessTokenConfig = {
      secret: process.env.JWT_ACCESS_SECRET || 'access-secret-key',
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    };

    // Refresh token: long-lived (30 days)
    this.refreshTokenConfig = {
      secret: process.env.JWT_REFRESH_SECRET || 'refresh-secret-key',
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    };
  }

  // Generate access token
  generateAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
    const tokenPayload: JwtPayload = {
      sub: payload.sub,
      email: payload.email,
    };

    return jwt.sign(tokenPayload, this.accessTokenConfig.secret, {
      expiresIn: this.accessTokenConfig.expiresIn,
    });
  }

  // Generate refresh token
  generateRefreshToken(
    payload: Omit<RefreshTokenPayload, 'iat' | 'exp'>,
  ): string {
    const tokenPayload: RefreshTokenPayload = {
      sub: payload.sub,
      email: payload.email,
      tokenId: payload.tokenId,
      type: 'refresh',
    };

    return jwt.sign(tokenPayload, this.refreshTokenConfig.secret, {
      expiresIn: this.refreshTokenConfig.expiresIn,
    });
  }

  // Verify access token
  verifyAccessToken(token: string): JwtPayload {
    try {
      const payload = jwt.verify(
        token,
        this.accessTokenConfig.secret,
      ) as JwtPayload;

      // Additional validation
      if (!payload.sub || !payload.email) {
        throw new Error('Invalid access token payload');
      }

      return payload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Access token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid access token');
      }
      throw error;
    }
  }

  // Verify refresh token
  verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      const payload = jwt.verify(
        token,
        this.refreshTokenConfig.secret,
      ) as RefreshTokenPayload;

      // Additional validation
      if (
        !payload.sub ||
        !payload.email ||
        !payload.tokenId ||
        payload.type !== 'refresh'
      ) {
        throw new Error('Invalid refresh token payload');
      }

      return payload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Refresh token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid refresh token');
      }
      throw error;
    }
  }

  // Decode token without verification (for debugging)
  decodeToken<T = JwtPayload | RefreshTokenPayload>(token: string): T | null {
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
