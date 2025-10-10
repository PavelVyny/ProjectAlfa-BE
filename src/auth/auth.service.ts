import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseService } from '../firebase/firebase.service';
import { GoogleAuthService } from './google-auth.service';
import { RegisterDto, LoginDto, GoogleAuthDto, AuthResponseDto, SendPasswordResetDto, ChangePasswordDto, ChangePasswordResponseDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private firebaseService: FirebaseService,
    private googleAuthService: GoogleAuthService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { email, password, nickname } = registerDto;

    // Шаг 1: Проверяем, существует ли пользователь в PostgreSQL
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Шаг 2: Проверяем, существует ли пользователь в Firebase
    const firebaseUserExists = await this.firebaseService.userExists(email);
    if (firebaseUserExists) {
      throw new ConflictException(
        'User with this email already exists in Firebase',
      );
    }

    try {
      // Шаг 3: Создаем пользователя в Firebase
      const displayName = nickname || undefined;
      const firebaseUid = await this.firebaseService.createUser(
        email,
        password,
        displayName,
      );

      console.log(`✅ Пользователь создан в Firebase с UID: ${firebaseUid}`);

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

      console.log(`✅ Пользователь создан в PostgreSQL с ID: ${user.id}`);

      // Шаг 6: Генерируем JWT токен
      const payload = { email: user.email, sub: user.id };
      const accessToken = this.jwtService.sign(payload);

      return {
        access_token: accessToken,
        user: {
          id: user.id,
          email: user.email,
          nickname: user.nickname || undefined,
          googleId: user.googleId || undefined,
        },
      };
    } catch (error) {
      // Если что-то пошло не так, логируем ошибку
      console.error('❌ Ошибка при создании пользователя:', error);

      // Если пользователь создался в Firebase, но не в PostgreSQL, удаляем его из Firebase
      if (error instanceof Error && error.message.includes('Firebase')) {
        // Пытаемся найти и удалить пользователя из Firebase
        try {
          const firebaseUser = await this.firebaseService.getUserByEmail(email);
          if (firebaseUser) {
            await this.firebaseService.deleteUser(firebaseUser.uid);
            console.log('✅ Пользователь удален из Firebase после ошибки');
          }
        } catch (deleteError) {
          console.error(
            '❌ Не удалось удалить пользователя из Firebase:',
            deleteError,
          );
        }
      }

      throw error;
    }
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    // Проверяем пароль в Firebase
    const firebaseUser = await this.firebaseService.verifyPasswordAndGetUser(email, password);
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

    // Генерируем JWT токен
    const payload = { email: user.email, sub: user.id };
    const accessToken = this.jwtService.sign(payload);

    return {
      access_token: accessToken,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname || undefined,
        googleId: user.googleId || undefined,
      },
    };
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      return null;
    }

    return user;
  }

  async googleAuth(googleAuthDto: GoogleAuthDto): Promise<AuthResponseDto> {
    const { credential } = googleAuthDto;

    try {
      // Верифицируем Google токен
      const googleUser = await this.googleAuthService.verifyGoogleToken(credential);

      if (!googleUser.email || !googleUser.emailVerified) {
        throw new UnauthorizedException('Google email not verified or missing');
      }

      // Ищем существующего пользователя по email или googleId
      let user = await this.prisma.user.findFirst({
        where: {
          OR: [
            { email: googleUser.email },
            { googleId: googleUser.googleId },
          ],
        },
      });

      if (user) {
        // Обновляем информацию о пользователе, если он уже существует
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: googleUser.googleId,
            nickname: user.nickname, // Сохраняем существующий nickname
            avatar: googleUser.avatar || user.avatar,
          },
        });
      } else {
        // Создаем нового пользователя
        let firebaseUid: string | null = null;
        
        try {
          // Проверяем, существует ли пользователь в Firebase
          const firebaseUserExists = await this.firebaseService.userExists(googleUser.email);
          
          if (!firebaseUserExists) {
            // Создаем пользователя в Firebase без пароля (только email)
            const displayName = googleUser.firstName && googleUser.lastName 
              ? `${googleUser.firstName} ${googleUser.lastName}` 
              : undefined;
            
            firebaseUid = await this.firebaseService.createUserWithoutPassword(
              googleUser.email,
              displayName,
              googleUser.avatar
            );
            
            console.log(`✅ Google пользователь создан в Firebase с UID: ${firebaseUid}`);
          } else {
            // Если пользователь уже существует в Firebase, получаем его UID
            const existingFirebaseUser = await this.firebaseService.getUserByEmail(googleUser.email);
            firebaseUid = existingFirebaseUser?.uid || null;
            console.log(`✅ Google пользователь уже существует в Firebase с UID: ${firebaseUid}`);
          }
        } catch (firebaseError) {
          console.error('❌ Ошибка при работе с Firebase:', firebaseError);
          // Продолжаем создание пользователя в PostgreSQL даже если Firebase недоступен
          firebaseUid = null;
        }

        user = await this.prisma.user.create({
          data: {
            email: googleUser.email,
            googleId: googleUser.googleId,
            nickname: googleUser.firstName && googleUser.lastName 
              ? `${googleUser.firstName} ${googleUser.lastName}` 
              : undefined, // Создаем nickname из имени и фамилии Google
            avatar: googleUser.avatar,
            firebaseUid, // Привязываем к Firebase UID если удалось создать
            // password остается null для Google пользователей
          },
        });

        console.log(`✅ Google пользователь создан в PostgreSQL с ID: ${user.id}`);
      }

      // Генерируем JWT токен
      const payload = { email: user.email, sub: user.id };
      const accessToken = this.jwtService.sign(payload);

      return {
        access_token: accessToken,
        user: {
          id: user.id,
          email: user.email,
          nickname: user.nickname || undefined,
          avatar: user.avatar || undefined,
          googleId: user.googleId || undefined,
        },
      };
    } catch (error) {
      console.error('❌ Ошибка при Google авторизации:', error);
      throw new UnauthorizedException('Google authentication failed');
    }
  }

  async sendPasswordReset(sendPasswordResetDto: SendPasswordResetDto): Promise<{ message: string }> {
    const { email } = sendPasswordResetDto;

    // Проверяем, существует ли пользователь в PostgreSQL
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Для безопасности не сообщаем, что пользователь не найден
      return { message: 'If a user with this email exists, a password reset email has been sent' };
    }

    // Проверяем, что у пользователя есть пароль (не Google-пользователь)
    if (!user.password) {
      // Проверяем, является ли пользователь Google-пользователем
      if (user.googleId) {
        return { message: 'Google users cannot reset their password. Please use Google to sign in.' };
      }
      return { message: 'If a user with this email exists, a password reset email has been sent' };
    }

    try {
      // Отправляем письмо сброса пароля через Firebase
      await this.firebaseService.sendPasswordResetEmail(email);
      
      return { message: 'Password reset email has been sent to your email address' };
    } catch (error) {
      console.error('❌ Ошибка отправки письма сброса пароля:', error);
      
      // В случае ошибки не раскрываем детали для безопасности
      return { message: 'If a user with this email exists, a password reset email has been sent' };
    }
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<ChangePasswordResponseDto> {
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
    const isCurrentPasswordValid = await this.firebaseService.verifyPassword(user.email, currentPassword);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    try {
      // Обновляем пароль только в Firebase
      await this.firebaseService.updateUserPassword(user.firebaseUid, newPassword);
      console.log(`✅ Пароль обновлен в Firebase для пользователя: ${user.email}`);

      return { message: 'Password changed successfully' };
    } catch (error) {
      console.error('❌ Ошибка при изменении пароля:', error);
      throw new BadRequestException('Failed to change password');
    }
  }
}
