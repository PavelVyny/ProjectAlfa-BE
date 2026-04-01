import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminJwtService } from './admin-jwt.service';
import { AdminRefreshTokenService } from './admin-refresh-token.service';
import * as bcrypt from 'bcryptjs';
import {
  AdminLoginDto,
  AdminAuthResponseDto,
  AdminRefreshTokenResponseDto,
  AdminLogoutResponseDto,
} from './dto/admin-auth.dto';

@Injectable()
export class AdminAuthService {
  constructor(
    private prisma: PrismaService,
    private adminJwtService: AdminJwtService,
    private adminRefreshTokenService: AdminRefreshTokenService,
  ) {}

  /**
   * Login admin
   * Verifies credentials against the database using bcrypt (no Firebase dependency)
   */
  async login(loginDto: AdminLoginDto): Promise<AdminAuthResponseDto> {
    const { email, password } = loginDto;

    // Find admin by email
    const admin = await this.prisma.admin.findUnique({
      where: { email },
    });

    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password using bcrypt
    const isPasswordValid = await bcrypt.compare(password, admin.password_hash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate access token
    const accessToken = this.adminJwtService.generateAccessToken({
      sub: admin.id,
      email: admin.email,
      type: 'admin',
    });

    // Create refresh token
    const { token: refreshToken } =
      await this.adminRefreshTokenService.createRefreshToken({
        adminId: admin.id,
        email: admin.email,
      });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
      },
    };
  }

  /**
   * Refresh admin tokens
   * Validates old refresh token, rotates it and issues a new access token
   */
  async refreshToken(
    refreshToken: string,
  ): Promise<AdminRefreshTokenResponseDto> {
    const startTime = Date.now();

    try {
      // Validate the refresh token
      const validation =
        await this.adminRefreshTokenService.validateRefreshToken(refreshToken);

      if (!validation.isValid || !validation.refreshToken) {
        throw new UnauthorizedException(
          validation.error || 'Invalid admin refresh token',
        );
      }

      // Get admin data
      const admin = await this.validateAdmin(validation.adminId!);
      if (!admin) {
        throw new UnauthorizedException('Admin not found');
      }

      // Generate new access token
      const newAccessToken = this.adminJwtService.generateAccessToken({
        sub: admin.id,
        email: admin.email,
        type: 'admin',
      });

      // Token rotation: revoke old and create new refresh token
      await this.adminRefreshTokenService.revokeRefreshToken(
        validation.refreshToken.id,
      );

      const { token: newRefreshToken } =
        await this.adminRefreshTokenService.createRefreshToken({
          adminId: admin.id,
          email: admin.email,
        });

      const duration = Date.now() - startTime;
      console.log('Admin token refresh completed', {
        duration: `${duration}ms`,
        adminId: admin.id,
        timestamp: new Date().toISOString(),
      });

      return {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('Admin token refresh failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      });
      throw error instanceof UnauthorizedException
        ? error
        : new UnauthorizedException('Token refresh failed');
    }
  }

  /**
   * Logout admin
   * Revokes the provided refresh token
   */
  async logout(refreshToken: string): Promise<AdminLogoutResponseDto> {
    try {
      const validation =
        await this.adminRefreshTokenService.validateRefreshToken(refreshToken);

      if (validation.isValid && validation.refreshToken) {
        await this.adminRefreshTokenService.revokeRefreshToken(
          validation.refreshToken.id,
        );
      }

      return { message: 'Logged out successfully' };
    } catch (error) {
      console.error('Error during admin logout:', error);
      // Even if there is an error, logout is considered successful
      // to prevent information leakage
      return { message: 'Logged out successfully' };
    }
  }

  /**
   * Validate admin by ID (used by strategy)
   */
  async validateAdmin(adminId: string) {
    return await this.prisma.admin.findUnique({
      where: { id: adminId },
    });
  }
}
