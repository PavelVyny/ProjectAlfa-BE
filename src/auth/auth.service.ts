import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseService } from '../firebase/firebase.service';
import { GoogleAuthService } from './google-auth.service';
import { RegisterDto, LoginDto, GoogleAuthDto, AuthResponseDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private firebaseService: FirebaseService,
    private googleAuthService: GoogleAuthService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { email, password, firstName, lastName } = registerDto;

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
      const displayName =
        firstName && lastName ? `${firstName} ${lastName}` : undefined;
      const firebaseUid = await this.firebaseService.createUser(
        email,
        password,
        displayName,
      );

      console.log(`✅ Пользователь создан в Firebase с UID: ${firebaseUid}`);

      // Шаг 4: Хешируем пароль для PostgreSQL
      const hashedPassword = await bcrypt.hash(password, 10);

      // Шаг 5: Создаем пользователя в PostgreSQL с привязкой к Firebase
      const user = await this.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          firebaseUid, // Привязываем к Firebase UID
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
          firstName: user.firstName || undefined,
          lastName: user.lastName || undefined,
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

    // Ищем пользователя по email в PostgreSQL
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Проверяем пароль (только если пользователь не Google-пользователь)
    if (!user.password) {
      throw new UnauthorizedException('Invalid credentials - no password set');
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Генерируем JWT токен
    const payload = { email: user.email, sub: user.id };
    const accessToken = this.jwtService.sign(payload);

    return {
      access_token: accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
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
            firstName: googleUser.firstName || user.firstName,
            lastName: googleUser.lastName || user.lastName,
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
            firstName: googleUser.firstName,
            lastName: googleUser.lastName,
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
          firstName: user.firstName || undefined,
          lastName: user.lastName || undefined,
          avatar: user.avatar || undefined,
        },
      };
    } catch (error) {
      console.error('❌ Ошибка при Google авторизации:', error);
      throw new UnauthorizedException('Google authentication failed');
    }
  }
}
