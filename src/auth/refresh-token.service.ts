import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from './jwt.service';
import * as bcrypt from 'bcryptjs';

// Temporary RefreshToken interface until Prisma generates types
interface RefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  deviceId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  isActive: boolean;
}

// Refresh token creation data
export interface CreateRefreshTokenData {
  userId: string;
  userAgent?: string;
  ipAddress?: string;
  deviceId?: string;
}

// Refresh token validation result
export interface RefreshTokenValidationResult {
  isValid: boolean;
  refreshToken: RefreshToken | null;
  userId: string | null;
  error?: string;
}

@Injectable()
export class RefreshTokenService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // Create new refresh token
  async createRefreshToken(data: CreateRefreshTokenData): Promise<{
    token: string;
    refreshTokenEntity: RefreshToken;
  }> {
    const { userId, userAgent, ipAddress, deviceId } = data;

    // Generate unique token ID for database
    const tokenId = crypto.randomUUID();

    // Generate JWT refresh token
    const refreshToken = this.jwtService.generateRefreshToken({
      sub: userId,
      email: '', // Will be set later if needed
      tokenId,
      type: 'refresh',
    });

    // Hash the token for storage
    const tokenHash = await bcrypt.hash(refreshToken, 12);

    // Calculate expiration date (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Save to database
    const refreshTokenEntity = await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        userAgent,
        ipAddress,
        deviceId,
        expiresAt,
        isActive: true,
      },
    });

    return {
      token: refreshToken,
      refreshTokenEntity,
    };
  }

  // Validate refresh token
  async validateRefreshToken(
    token: string,
  ): Promise<RefreshTokenValidationResult> {
    try {
      // Verify JWT token
      const payload = this.jwtService.verifyRefreshToken(token);

      // Find token in database
      const refreshTokenEntity = await this.prisma.refreshToken.findUnique({
        where: { id: payload.tokenId },
      });

      if (!refreshTokenEntity) {
        return {
          isValid: false,
          refreshToken: null,
          userId: null,
          error: 'Refresh token not found in database',
        };
      }

      // Check if token is active
      if (!refreshTokenEntity.isActive) {
        return {
          isValid: false,
          refreshToken: refreshTokenEntity,
          userId: null,
          error: 'Refresh token has been revoked',
        };
      }

      // Check if token is expired
      if (new Date() > refreshTokenEntity.expiresAt) {
        return {
          isValid: false,
          refreshToken: refreshTokenEntity,
          userId: null,
          error: 'Refresh token has expired',
        };
      }

      // Verify token hash matches
      const isTokenValid = await bcrypt.compare(
        token,
        refreshTokenEntity.tokenHash,
      );
      if (!isTokenValid) {
        return {
          isValid: false,
          refreshToken: refreshTokenEntity,
          userId: null,
          error: 'Refresh token hash mismatch',
        };
      }

      return {
        isValid: true,
        refreshToken: refreshTokenEntity,
        userId: refreshTokenEntity.userId,
      };
    } catch (error) {
      return {
        isValid: false,
        refreshToken: null,
        userId: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Revoke refresh token (for logout)
  async revokeRefreshToken(tokenId: string): Promise<boolean> {
    try {
      await this.prisma.refreshToken.update({
        where: { id: tokenId },
        data: { isActive: false },
      });
      return true;
    } catch {
      return false;
    }
  }

  // Revoke all refresh tokens for user (security feature)
  async revokeAllUserTokens(userId: string): Promise<number> {
    const result = await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { isActive: false },
    });

    return result.count;
  }

  // Clean up expired tokens (maintenance task)
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: new Date() } }, { isActive: false }],
      },
    });

    return result.count;
  }

  // Get active tokens count for user
  async getActiveTokensCount(userId: string): Promise<number> {
    return await this.prisma.refreshToken.count({
      where: {
        userId,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
    });
  }

  // Rotate refresh token (create new, revoke old)
  async rotateRefreshToken(
    oldTokenId: string,
    userId: string,
    metadata?: { userAgent?: string; ipAddress?: string; deviceId?: string },
  ): Promise<{
    token: string;
    refreshTokenEntity: RefreshToken;
  } | null> {
    // Revoke old token
    const revoked = await this.revokeRefreshToken(oldTokenId);
    if (!revoked) {
      return null;
    }

    // Create new token
    return await this.createRefreshToken({
      userId,
      ...metadata,
    });
  }

  // Find refresh token by ID
  async findRefreshTokenById(tokenId: string): Promise<RefreshToken | null> {
    return await this.prisma.refreshToken.findUnique({
      where: { id: tokenId },
    });
  }

  // Get all active refresh tokens for user
  async getUserActiveTokens(userId: string): Promise<RefreshToken[]> {
    return await this.prisma.refreshToken.findMany({
      where: {
        userId,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
