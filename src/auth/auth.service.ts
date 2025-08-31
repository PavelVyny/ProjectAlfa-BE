import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseService } from '../firebase/firebase.service';
import { RegisterDto, LoginDto, AuthResponseDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private firebaseService: FirebaseService, // Добавляем Firebase сервис
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
        accessToken,
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

    // Проверяем пароль
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Генерируем JWT токен
    const payload = { email: user.email, sub: user.id };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
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
}
