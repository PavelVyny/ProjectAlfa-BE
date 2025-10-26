import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
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
      // Шаг 3: Создаем пользователя в Firebase
      const displayName = nickname || undefined;
      const firebaseUid = await this.firebaseService.createUser(
        email,
        password,
        displayName,
      );

      // Шаг 4: Создаем пользователя в PostgreSQL с привязкой к Firebase
      // Пароль НЕ храним в PostgreSQL - только в Firebase
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

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    // Проверяем пароль в Firebase
    const firebaseUser = await this.firebaseService.verifyPasswordAndGetUser(
      email,
      password,
    );
    if (!firebaseUser) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Ищем или создаем пользователя в PostgreSQL
    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Создаем пользователя в PostgreSQL, если его нет
      user = await this.prisma.user.create({
        data: {
          email,
          firebaseUid: firebaseUser.uid,
          // password остается null - не храним пароли в PostgreSQL
        },
      });
      console.log(`✅ Пользователь создан в PostgreSQL: ${user.email}`);
    } else {
      // Обновляем Firebase UID, если его нет
      if (!user.firebaseUid) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { firebaseUid: firebaseUser.uid },
        });
        console.log(`✅ Firebase UID обновлен для пользователя: ${user.email}`);
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
      // Верифицируем Google токен
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
        // Обновляем информацию о пользователе, если он уже существует
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: googleUser.googleId,
            nickname: user.nickname ?? undefined, // Сохраняем существующий nickname
            avatar: googleUser.avatar ?? user.avatar ?? undefined,
          },
        });
      } else {
        // Создаем нового пользователя
        let firebaseUid: string | null = null;

        try {
          // Проверяем, существует ли пользователь в Firebase
          const firebaseUserExists = await this.firebaseService.userExists(
            googleUser.email,
          );

          if (!firebaseUserExists) {
            // Создаем пользователя в Firebase без пароля (только email)
            firebaseUid = await this.firebaseService.createUserWithoutPassword(
              googleUser.email,
              googleUser.nickname,
              googleUser.avatar,
            );

            console.log(
              `✅ Google пользователь создан в Firebase с UID: ${firebaseUid}`,
            );
          } else {
            // Если пользователь уже существует в Firebase, получаем его UID
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
    try {
      // Validate the refresh token
      const validation =
        await this.refreshTokenService.validateRefreshToken(refreshToken);

      if (!validation.isValid || !validation.refreshToken) {
        throw new InvalidRefreshTokenException();
      }

      // Get user data
      const user = await this.validateUser(validation.userId!);
      if (!user) {
        throw new UserNotFoundException();
      }

      // Create new access token
      const payload = { email: user.email, sub: user.id };
      const newAccessToken = this.jwtService.generateAccessToken(payload);

      // Create new refresh token and revoke old one
      await this.refreshTokenService.revokeRefreshToken(
        validation.refreshToken.id,
      );

      const { token: newRefreshToken } =
        await this.refreshTokenService.createRefreshToken({
          userId: user.id,
          email: user.email,
        });

      return {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
      };
    } catch (error) {
      console.error('❌ Error refreshing token:', error);
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

    // Проверяем, существует ли пользователь в PostgreSQL
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

    // Проверяем, что у пользователя есть пароль (не Google-пользователь)
    if (!user.password) {
      // Проверяем, является ли пользователь Google-пользователем
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
      // Отправляем письмо сброса пароля через Firebase
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

    // Находим пользователя
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Проверяем, что у пользователя есть Firebase UID
    if (!user.firebaseUid) {
      throw new BadRequestException('User not linked to Firebase');
    }

    // Проверяем текущий пароль в Firebase
    const isCurrentPasswordValid = await this.firebaseService.verifyPassword(
      user.email,
      currentPassword,
    );
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    try {
      // Обновляем пароль только в Firebase
      await this.firebaseService.updateUserPassword(
        user.firebaseUid,
        newPassword,
      );
      console.log(
        `✅ Пароль обновлен в Firebase для пользователя: ${user.email}`,
      );

      return { message: 'Password changed successfully' };
    } catch (error) {
      console.error('❌ Ошибка при изменении пароля:', error);
      throw new BadRequestException('Failed to change password');
    }
  }
}
