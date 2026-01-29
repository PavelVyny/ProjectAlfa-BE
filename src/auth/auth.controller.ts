import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Res,
  Req,
} from '@nestjs/common';
import { Response, Request as ExpressRequest } from 'express';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  GoogleAuthDto,
  AuthResponseDto,
  SendPasswordResetDto,
  ChangePasswordDto,
  ChangePasswordResponseDto,
  UpdateProfileDto,
  UpdateProfileResponseDto,
  LogoutResponseDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { parseExpiryToMs } from '../common/utils/date.util';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Helper method to set refresh token as httpOnly cookie
   * Security: httpOnly prevents XSS attacks, secure flag for HTTPS in production
   */
  private setRefreshTokenCookie(res: Response, refreshToken: string): void {
    const isProduction = process.env.NODE_ENV === 'production';

    // Parse refresh token expiry from env (e.g., "30d" or "3m")
    // Default to 30 days if not set
    const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
    const maxAgeMs = parseExpiryToMs(refreshExpiresIn);

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true, // Prevents JavaScript access (XSS protection)
      secure: isProduction, // HTTPS only in production
      sameSite: 'strict', // CSRF protection
      maxAge: maxAgeMs, // Use environment variable
      path: '/', // Available across entire domain
    });

    console.log('🍪 [AUTH] Refresh token cookie set', {
      secure: isProduction,
      expiresIn: refreshExpiresIn,
      maxAgeMs,
    });
  }

  /**
   * Helper method to clear refresh token cookie
   */
  private clearRefreshTokenCookie(res: Response): void {
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    console.log('🗑️ [AUTH] Refresh token cookie cleared');
  }

  @Post('register')
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<AuthResponseDto, 'refresh_token'>> {
    const authData = await this.authService.register(registerDto);

    // Set refresh token in httpOnly cookie
    this.setRefreshTokenCookie(res, authData.refresh_token);

    // Return only access_token and user data (refresh_token in cookie)
    return {
      access_token: authData.access_token,
      user: authData.user,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<AuthResponseDto, 'refresh_token'>> {
    const authData = await this.authService.login(loginDto);

    // Set refresh token in httpOnly cookie
    this.setRefreshTokenCookie(res, authData.refresh_token);

    // Return only access_token and user data (refresh_token in cookie)
    return {
      access_token: authData.access_token,
      user: authData.user,
    };
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  async googleAuth(
    @Body() googleAuthDto: GoogleAuthDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<AuthResponseDto, 'refresh_token'>> {
    const authData = await this.authService.googleAuth(googleAuthDto);

    // Set refresh token in httpOnly cookie
    this.setRefreshTokenCookie(res, authData.refresh_token);

    // Return only access_token and user data (refresh_token in cookie)
    return {
      access_token: authData.access_token,
      user: authData.user,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ access_token: string }> {
    // Extract refresh token from httpOnly cookie
    const cookies = req.cookies as Record<string, string> | undefined;
    const refreshToken = cookies?.refresh_token;

    if (!refreshToken) {
      console.log('❌ [AUTH] No refresh token found in cookies');
      throw new Error('Refresh token not found');
    }

    // Refresh tokens (returns new access_token and refresh_token)
    const tokens = await this.authService.refreshToken(refreshToken);

    // Set new refresh token in cookie (token rotation)
    this.setRefreshTokenCookie(res, tokens.refresh_token);

    console.log('✅ [AUTH] Token refresh successful');

    // Return only new access_token
    return {
      access_token: tokens.access_token,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LogoutResponseDto> {
    // Extract refresh token from cookie
    const cookies = req.cookies as Record<string, string> | undefined;
    const refreshToken = cookies?.refresh_token;

    if (refreshToken) {
      // Revoke refresh token in database
      await this.authService.logout(refreshToken);
    }

    // Clear refresh token cookie
    this.clearRefreshTokenCookie(res);

    console.log('✅ [AUTH] Logout successful');

    return { message: 'Logged out successfully' };
  }

  @Post('send-password-reset')
  @HttpCode(HttpStatus.OK)
  async sendPasswordReset(
    @Body() sendPasswordResetDto: SendPasswordResetDto,
  ): Promise<{ message: string }> {
    return this.authService.sendPasswordReset(sendPasswordResetDto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Request() req: { user: { id: string } },
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<ChangePasswordResponseDto> {
    return this.authService.changePassword(req.user.id, changePasswordDto);
  }

  @Post('profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @Request() req: { user: { id: string } },
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<UpdateProfileResponseDto> {
    const updatedUser = await this.authService.updateProfile(
      req.user.id,
      updateProfileDto,
    );

    console.log('✅ [AUTH] Profile updated successfully', {
      userId: updatedUser.id,
    });

    return { user: updatedUser };
  }

  // Development-only debug endpoints
  @Get('debug/token-info')
  @UseGuards(JwtAuthGuard)
  debugTokenInfo(@Request() req: { user: { id: string; email: string } }): {
    message: string;
    user: { id: string; email: string };
  } {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Debug endpoints not available in production');
    }

    console.log('🐛 [AUTH] Debug: Token info requested');

    return {
      message: 'Token information',
      user: req.user,
    };
  }
}
