import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminJwtService } from './admin-jwt.service';
import * as bcrypt from 'bcryptjs';
import { AdminRefreshToken } from '@prisma/client';
import { parseExpiryToMs } from '../common/utils/date.util';

// Admin refresh token creation data
export interface CreateAdminRefreshTokenData {
  adminId: string;
  email: string;
  userAgent?: string;
  ipAddress?: string;
}

// Admin refresh token validation result
export interface AdminRefreshTokenValidationResult {
  isValid: boolean;
  refreshToken: AdminRefreshToken | null;
  adminId: string | null;
  error?: string;
}

@Injectable()
export class AdminRefreshTokenService {
  constructor(
    private prisma: PrismaService,
    private adminJwtService: AdminJwtService,
  ) {}

  // Create new admin refresh token
  async createRefreshToken(data: CreateAdminRefreshTokenData): Promise<{
    token: string;
    refreshTokenEntity: AdminRefreshToken;
  }> {
    const { adminId, email, userAgent, ipAddress } = data;

    // Generate unique token ID for database
    const tokenId = crypto.randomUUID();

    // Generate JWT refresh token
    const refreshToken = this.adminJwtService.generateRefreshToken({
      sub: adminId,
      email,
      tokenId,
      type: 'admin',
      tokenType: 'refresh',
    });

    // Hash the token for storage
    const tokenHash = await bcrypt.hash(refreshToken, 12);

    // Calculate expiration date
    const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
    const maxAgeMs = parseExpiryToMs(refreshExpiresIn);

    const expiresAt = new Date();
    expiresAt.setTime(expiresAt.getTime() + maxAgeMs);

    // Save to database using adminRefreshToken model
    const refreshTokenEntity = await this.prisma.adminRefreshToken.create({
      data: {
        id: tokenId,
        adminId,
        tokenHash,
        userAgent,
        ipAddress,
        expiresAt,
        isActive: true,
      },
    });

    return {
      token: refreshToken,
      refreshTokenEntity,
    };
  }

  // Validate admin refresh token
  async validateRefreshToken(
    token: string,
  ): Promise<AdminRefreshTokenValidationResult> {
    try {
      // Verify JWT token
      const payload = this.adminJwtService.verifyRefreshToken(token);

      // Find token in database
      const refreshTokenEntity = await this.prisma.adminRefreshToken.findUnique(
        {
          where: { id: payload.tokenId },
        },
      );

      if (!refreshTokenEntity) {
        return {
          isValid: false,
          refreshToken: null,
          adminId: null,
          error: 'Admin refresh token not found in database',
        };
      }

      // Check if token is active
      if (!refreshTokenEntity.isActive) {
        return {
          isValid: false,
          refreshToken: refreshTokenEntity,
          adminId: null,
          error: 'Admin refresh token has been revoked',
        };
      }

      // Check if token is expired
      if (new Date() > refreshTokenEntity.expiresAt) {
        return {
          isValid: false,
          refreshToken: refreshTokenEntity,
          adminId: null,
          error: 'Admin refresh token has expired',
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
          adminId: null,
          error: 'Admin refresh token hash mismatch',
        };
      }

      return {
        isValid: true,
        refreshToken: refreshTokenEntity,
        adminId: refreshTokenEntity.adminId,
      };
    } catch (error) {
      return {
        isValid: false,
        refreshToken: null,
        adminId: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Revoke admin refresh token (for logout)
  async revokeRefreshToken(tokenId: string): Promise<boolean> {
    try {
      await this.prisma.adminRefreshToken.update({
        where: { id: tokenId },
        data: { isActive: false },
      });
      return true;
    } catch {
      return false;
    }
  }

  // Revoke all refresh tokens for admin (security feature)
  async revokeAllAdminTokens(adminId: string): Promise<number> {
    const result = await this.prisma.adminRefreshToken.updateMany({
      where: { adminId },
      data: { isActive: false },
    });

    return result.count;
  }

  // Clean up expired tokens (maintenance task)
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.prisma.adminRefreshToken.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: new Date() } }, { isActive: false }],
      },
    });

    return result.count;
  }

  // Get active tokens count for admin
  async getActiveTokensCount(adminId: string): Promise<number> {
    return await this.prisma.adminRefreshToken.count({
      where: {
        adminId,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
    });
  }

  // Rotate refresh token (create new, revoke old)
  async rotateRefreshToken(
    oldTokenId: string,
    adminId: string,
    email: string,
    metadata?: { userAgent?: string; ipAddress?: string },
  ): Promise<{
    token: string;
    refreshTokenEntity: AdminRefreshToken;
  } | null> {
    // Revoke old token
    const revoked = await this.revokeRefreshToken(oldTokenId);
    if (!revoked) {
      return null;
    }

    // Create new token
    return await this.createRefreshToken({
      adminId,
      email,
      ...metadata,
    });
  }

  // Find admin refresh token by ID
  async findRefreshTokenById(
    tokenId: string,
  ): Promise<AdminRefreshToken | null> {
    return await this.prisma.adminRefreshToken.findUnique({
      where: { id: tokenId },
    });
  }

  // Get all active refresh tokens for admin
  async getAdminActiveTokens(adminId: string): Promise<AdminRefreshToken[]> {
    return await this.prisma.adminRefreshToken.findMany({
      where: {
        adminId,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
