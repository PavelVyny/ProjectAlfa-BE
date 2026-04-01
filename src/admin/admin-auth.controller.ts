import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Res,
  Req,
} from '@nestjs/common';
import { Response, Request as ExpressRequest } from 'express';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto } from './dto/admin-auth.dto';
import { AdminJwtAuthGuard } from './admin-jwt-auth.guard';
import { parseExpiryToMs } from '../common/utils/date.util';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  /**
   * Helper: set admin_refresh_token httpOnly cookie
   * Cookie name is 'admin_refresh_token' — distinct from the user 'refresh_token' cookie
   */
  private setAdminRefreshTokenCookie(
    res: Response,
    refreshToken: string,
  ): void {
    const isProduction = process.env.NODE_ENV === 'production';
    const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
    const maxAgeMs = parseExpiryToMs(refreshExpiresIn);

    res.cookie('admin_refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'none',
      maxAge: maxAgeMs,
      path: '/',
    });

    console.log('[ADMIN AUTH] Admin refresh token cookie set', {
      secure: isProduction,
      expiresIn: refreshExpiresIn,
      maxAgeMs,
    });
  }

  /**
   * Helper: clear admin_refresh_token cookie
   * Options MUST be identical to the cookie() call (except maxAge)
   */
  private clearAdminRefreshTokenCookie(res: Response): void {
    const isProduction = process.env.NODE_ENV === 'production';

    res.clearCookie('admin_refresh_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'none',
      path: '/',
    });

    console.log('[ADMIN AUTH] Admin refresh token cookie cleared');
  }

  /**
   * POST /admin/auth/login
   * Validates credentials, sets admin_refresh_token cookie, returns access_token + admin data
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: AdminLoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{
    access_token: string;
    admin: { id: string; email: string; name: string };
  }> {
    const authData = await this.adminAuthService.login(loginDto);

    this.setAdminRefreshTokenCookie(res, authData.refresh_token);

    console.log('[ADMIN AUTH] Login successful', {
      adminId: authData.admin.id,
    });

    return {
      access_token: authData.access_token,
      admin: authData.admin,
    };
  }

  /**
   * POST /admin/auth/refresh
   * Rotates tokens using the admin_refresh_token cookie.
   * NO guard — the access token is intentionally expired at this point.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ access_token: string }> {
    const cookies = req.cookies as Record<string, string> | undefined;
    const refreshToken = cookies?.admin_refresh_token;

    if (!refreshToken) {
      console.log('[ADMIN AUTH] No admin_refresh_token found in cookies');
      throw new Error('Admin refresh token not found');
    }

    const tokens = await this.adminAuthService.refreshToken(refreshToken);

    this.setAdminRefreshTokenCookie(res, tokens.refresh_token);

    console.log('[ADMIN AUTH] Token refresh successful');

    return { access_token: tokens.access_token };
  }

  /**
   * POST /admin/auth/logout
   * Requires a valid admin access token. Revokes the refresh token and clears the cookie.
   */
  @Post('logout')
  @UseGuards(AdminJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const cookies = req.cookies as Record<string, string> | undefined;
    const refreshToken = cookies?.admin_refresh_token;

    if (refreshToken) {
      await this.adminAuthService.logout(refreshToken);
    }

    this.clearAdminRefreshTokenCookie(res);

    console.log('[ADMIN AUTH] Logout successful');

    return { message: 'Logged out successfully' };
  }
}
