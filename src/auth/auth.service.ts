import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseService } from '../firebase/firebase.service';
import { GoogleAuthService } from './google-auth.service';
import { JwtService } from './jwt.service';
import { RefreshTokenService } from './refresh-token.service';
import {
  RegisterDto,
  LoginDto,
  GoogleAuthDto,
  AuthResponseDto,
  RefreshTokenResponseDto,
  LogoutResponseDto,
  SendPasswordResetDto,
  ChangePasswordDto,
  ChangePasswordResponseDto,
  UserData,
} from './dto/auth.dto';
import {
  UserAlreadyExistsException,
  UserNotFoundException,
  InvalidRefreshTokenException,
  TokenRefreshFailedException,
  GoogleAuthFailedException,
} from '../common/exceptions/auth.exceptions';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService, // Our custom JWT service
    private firebaseService: FirebaseService,
    private googleAuthService: GoogleAuthService,
    private refreshTokenService: RefreshTokenService,
  ) {}

  /**
   * Register a new user
   * Creates user in Firebase (for auth) and PostgreSQL (for data)
   */
  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { email, password, nickname } = registerDto;

    // Step 1: Check if user already exists in PostgreSQL
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new UserAlreadyExistsException(email);
    }

    try {
      // Step 3: Create user in Firebase
      const displayName = nickname || undefined;
      const firebaseUid = await this.firebaseService.createUser(
        email,
        password,
        displayName,
      );

      // Step 4: Create user in PostgreSQL linked to Firebase
      // Password is NOT stored in PostgreSQL - only in Firebase
      const user = await this.prisma.user.create({
        data: {
          email,
          nickname,
          firebaseUid, // Привязываем к Firebase UID
          // password остается null - не храним пароли в PostgreSQL
        },
      });

      console.log(`✅ User created in PostgreSQL with ID: ${user.id}`);

      // Step 5: Generate tokens (access + refresh)
      const payload = { email: user.email, sub: user.id };
      const accessToken = this.jwtService.generateAccessToken(payload);

      // Create refresh token
      const { token: refreshToken } =
        await this.refreshTokenService.createRefreshToken({
          userId: user.id,
          email: user.email,
        });

      return {
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
          id: user.id,
          email: user.email,
          nickname: user.nickname ?? undefined,
          googleId: user.googleId ?? undefined,
        },
      };
    } catch (error) {
      // If something went wrong, log the error
      console.error('❌ Error creating user:', error);

      // If user was created in Firebase but not in PostgreSQL, delete from Firebase
      if (error instanceof Error && error.message.includes('PostgreSQL')) {
        try {
          // Here we would delete from Firebase if we had the UID
          console.log('🔄 Attempting to cleanup Firebase user...');
        } catch (deleteError) {
          console.error('❌ Failed to delete user from Firebase:', deleteError);
        }
      }

      throw error;
    }
  }

  /**
   * Login user
   * Verifies credentials against Firebase and ensures PostgreSQL user exists
   */
  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    // Verify password in Firebase
    const firebaseUser = await this.firebaseService.verifyPasswordAndGetUser(
      email,
      password,
    );

    if (!firebaseUser) {
      console.log('❌ [AUTH SERVICE] Firebase authentication failed', {
        email,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    console.log('✅ [AUTH SERVICE] Firebase authentication successful', {
      email: firebaseUser.email,
      uid: firebaseUser.uid,
    });

    // Find or create user in PostgreSQL
    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.log('📝 [AUTH SERVICE] User not found, creating new user...');
      // Create user in PostgreSQL if not found
      user = await this.prisma.user.create({
        data: {
          email,
          firebaseUid: firebaseUser.uid,
          // password остается null - не храним пароли в PostgreSQL
        },
      });
      console.log(
        `✅ [AUTH SERVICE] User created in PostgreSQL: ${user.email}`,
        {
          userId: user.id,
          firebaseUid: user.firebaseUid,
        },
      );
    } else {
      console.log('👤 [AUTH SERVICE] User found in PostgreSQL', {
        userId: user.id,
        currentFirebaseUid: user.firebaseUid,
        newFirebaseUid: firebaseUser.uid,
      });

      // Update Firebase UID if missing or changed
      if (!user.firebaseUid || user.firebaseUid !== firebaseUser.uid) {
        const oldUid = user.firebaseUid;
        console.log('🔄 [AUTH SERVICE] Updating Firebase UID...', {
          oldUid: oldUid || 'none',
          newUid: firebaseUser.uid,
        });
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { firebaseUid: firebaseUser.uid },
        });
        console.log(
          `✅ [AUTH SERVICE] Firebase UID updated for user: ${user.email}`,
        );
      } else {
        console.log(
          '✅ [AUTH SERVICE] Firebase UID already matches, no update needed',
        );
      }
    }

    // Generate tokens (access + refresh)
    const payload = { email: user.email, sub: user.id };
    const accessToken = this.jwtService.generateAccessToken(payload);

    // Create refresh token
    const { token: refreshToken } =
      await this.refreshTokenService.createRefreshToken({
        userId: user.id,
        email: user.email,
      });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname ?? undefined,
        googleId: user.googleId ?? undefined,
      },
    };
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    return user;
  }

  async googleAuth(googleAuthDto: GoogleAuthDto): Promise<AuthResponseDto> {
    const { credential } = googleAuthDto;

    try {
      // Verify Google token
      const googleUser =
        await this.googleAuthService.verifyGoogleToken(credential);

      console.log('✅ Google user verified:', {
        email: googleUser.email,
        nickname: googleUser.nickname,
      });

      // Step 2: Check if user exists in our database
      let user = await this.prisma.user.findFirst({
        where: {
          OR: [{ email: googleUser.email }, { googleId: googleUser.googleId }],
        },
      });

      if (user) {
        // Update user info if exists
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: googleUser.googleId,
            nickname: user.nickname ?? undefined, // Сохраняем существующий nickname
            avatar: googleUser.avatar ?? user.avatar ?? undefined,
          },
        });
      } else {
        // Create new user
        let firebaseUid: string | null = null;

        try {
          // Check if user exists in Firebase
          const firebaseUserExists = await this.firebaseService.userExists(
            googleUser.email,
          );

          if (!firebaseUserExists) {
            // Create user in Firebase without password
            firebaseUid = await this.firebaseService.createUserWithoutPassword(
              googleUser.email,
              googleUser.nickname,
              googleUser.avatar,
            );

            console.log(
              `✅ Google пользователь создан в Firebase с UID: ${firebaseUid}`,
            );
          } else {
            // If user exists in Firebase, get UID
            const existingFirebaseUser =
              await this.firebaseService.getUserByEmail(googleUser.email);
            firebaseUid = existingFirebaseUser?.uid || null;
            console.log(
              `✅ Google пользователь уже существует в Firebase с UID: ${firebaseUid}`,
            );
          }
        } catch (firebaseError) {
          console.warn(
            '⚠️ Failed to create Google user in Firebase:',
            firebaseError,
          );
          // Continue without Firebase
        }

        user = await this.prisma.user.create({
          data: {
            email: googleUser.email,
            googleId: googleUser.googleId,
            nickname: googleUser.nickname,
            avatar: googleUser.avatar,
            firebaseUid, // Link to Firebase UID if successful
            // password remains null for Google users
          },
        });

        console.log(
          `✅ Google пользователь создан в PostgreSQL с ID: ${user.id}`,
        );
      }

      // Generate tokens (access + refresh)
      const payload = { email: user.email, sub: user.id };
      const accessToken = this.jwtService.generateAccessToken(payload);

      // Create refresh token
      const { token: refreshToken } =
        await this.refreshTokenService.createRefreshToken({
          userId: user.id,
          email: user.email,
        });

      return {
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
          id: user.id,
          email: user.email,
          nickname: user.nickname ?? undefined,
          avatar: user.avatar ?? undefined,
          googleId: user.googleId ?? undefined,
        },
      };
    } catch (error) {
      console.error('❌ Error during Google authentication:', error);
      throw new GoogleAuthFailedException();
    }
  }

  // Refresh token method
  async refreshToken(refreshToken: string): Promise<RefreshTokenResponseDto> {
    const startTime = Date.now();

    try {
      // Step 1: Validate the refresh token
      // console.log('🔍 [AUTH SERVICE] Validating refresh token...');
      const validation =
        await this.refreshTokenService.validateRefreshToken(refreshToken);

      if (!validation.isValid || !validation.refreshToken) {
        console.log('❌ [AUTH SERVICE] Invalid refresh token', {
          reason: validation.error || 'Token validation failed',
        });
        throw new InvalidRefreshTokenException();
      }

      console.log('✅ [AUTH SERVICE] Refresh token validated', {
        userId: validation.userId,
        tokenId: validation.refreshToken.id,
      });

      // Step 2: Get user data
      const user = await this.validateUser(validation.userId!);
      if (!user) {
        console.log('❌ [AUTH SERVICE] User not found', {
          userId: validation.userId,
        });
        throw new UserNotFoundException();
      }

      console.log('✅ [AUTH SERVICE] User found', {
        userId: user.id,
        email: user.email,
      });

      // Step 3: Create new access token
      const payload = { email: user.email, sub: user.id };
      const newAccessToken = this.jwtService.generateAccessToken(payload);

      // Step 4: Token rotation - revoke old and create new refresh token
      await this.refreshTokenService.revokeRefreshToken(
        validation.refreshToken.id,
      );
      console.log('🗑️ [AUTH SERVICE] Old refresh token revoked');

      const { token: newRefreshToken } =
        await this.refreshTokenService.createRefreshToken({
          userId: user.id,
          email: user.email,
        });

      console.log('🆕 [AUTH SERVICE] New refresh token created');

      const duration = Date.now() - startTime;
      console.log('✅ [AUTH SERVICE] Token refresh completed successfully', {
        duration: `${duration}ms`,
        userId: user.id,
        timestamp: new Date().toISOString(),
      });

      return {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('❌ [AUTH SERVICE] Token refresh failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      });
      throw new TokenRefreshFailedException();
    }
  }

  // Logout method - revoke refresh token
  async logout(refreshToken: string): Promise<LogoutResponseDto> {
    try {
      // Validate and revoke the refresh token
      const validation =
        await this.refreshTokenService.validateRefreshToken(refreshToken);

      if (validation.isValid && validation.refreshToken) {
        await this.refreshTokenService.revokeRefreshToken(
          validation.refreshToken.id,
        );
      }

      return { message: 'Logged out successfully' };
    } catch (error) {
      console.error('❌ Error during logout:', error);
      // Even if there's an error, we consider logout successful
      // to prevent information leakage
      return { message: 'Logged out successfully' };
    }
  }

  async sendPasswordReset(
    sendPasswordResetDto: SendPasswordResetDto,
  ): Promise<{ message: string }> {
    const { email } = sendPasswordResetDto;

    // Check if user exists in PostgreSQL
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Для безопасности не сообщаем, что пользователь не найден
      return {
        message:
          'If a user with this email exists, a password reset email has been sent',
      };
    }

    // Check if user has password (not Google user)
    if (!user.password) {
      // Check if Google user
      if (user.googleId) {
        return {
          message:
            'Google users cannot reset their password. Please use Google to sign in.',
        };
      }
      return {
        message:
          'If a user with this email exists, a password reset email has been sent',
      };
    }

    try {
      // Send password reset email via Firebase
      await this.firebaseService.sendPasswordResetEmail(email);

      return {
        message: 'Password reset email has been sent to your email address',
      };
    } catch (error) {
      console.error('❌ Ошибка отправки письма сброса пароля:', error);

      // В случае ошибки не раскрываем детали для безопасности
      return {
        message:
          'If a user with this email exists, a password reset email has been sent',
      };
    }
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<ChangePasswordResponseDto> {
    const { currentPassword, newPassword } = changePasswordDto;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Check if user has Firebase UID
    if (!user.firebaseUid) {
      throw new BadRequestException('User not linked to Firebase');
    }

    // Verify current password in Firebase
    const isCurrentPasswordValid = await this.firebaseService.verifyPassword(
      user.email,
      currentPassword,
    );
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    try {
      // Update password only in Firebase
      await this.firebaseService.updateUserPassword(
        user.firebaseUid,
        newPassword,
      );
      console.log(`✅ Password updated in Firebase for user: ${user.email}`);

      return { message: 'Password changed successfully' };
    } catch (error) {
      console.error('❌ Ошибка при изменении пароля:', error);
      throw new BadRequestException('Failed to change password');
    }
  }

  async updateProfile(
    userId: string,
    updateProfileDto: { nickname?: string; email?: string },
  ): Promise<UserData> {
    console.log('📝 [AUTH SERVICE] Updating user profile', {
      userId,
      updates: updateProfileDto,
    });

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UserNotFoundException();
    }

    // Prepare update data
    const updateData: { nickname?: string | null; email?: string } = {};

    if (updateProfileDto.nickname !== undefined) {
      updateData.nickname = updateProfileDto.nickname || null;
    }

    if (
      updateProfileDto.email !== undefined &&
      updateProfileDto.email !== user.email
    ) {
      // TypeScript type narrowing: email is definitely string here
      const newEmail: string = updateProfileDto.email;
      // Check if email is already taken
      const existingUser = await this.prisma.user.findUnique({
        where: { email: newEmail },
      });

      if (existingUser && existingUser.id !== userId) {
        throw new ConflictException('Email already in use');
      }

      updateData.email = newEmail;

      // Update email in Firebase if user has Firebase UID
      if (user.firebaseUid) {
        try {
          await this.firebaseService.updateUserEmail(
            user.firebaseUid,
            newEmail,
          );
          console.log(`✅ Email updated in Firebase for user: ${user.id}`);
        } catch (error) {
          console.error('❌ Error updating email in Firebase:', error);
          throw new BadRequestException('Failed to update email in Firebase');
        }
      }
    }

    // Update user in database
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    console.log('✅ [AUTH SERVICE] Profile updated successfully', {
      userId: updatedUser.id,
      changes: updateData,
    });

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      nickname: updatedUser.nickname ?? undefined,
      avatar: updatedUser.avatar ?? undefined,
      googleId: updatedUser.googleId ?? undefined,
    };
  }
}
