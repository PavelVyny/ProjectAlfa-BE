import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseService } from '../firebase/firebase.service';
import { GoogleAuthService } from './google-auth.service';
import { JwtService } from './jwt.service';
import { RefreshTokenService } from './refresh-token.service';
import {
  UserAlreadyExistsException,
  TokenRefreshFailedException,
} from '../common/exceptions/auth.exceptions';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const mockFirebaseService = {
    createUser: jest.fn(),
    verifyPasswordAndGetUser: jest.fn(),
    userExists: jest.fn(),
    createUserWithoutPassword: jest.fn(),
    getUserByEmail: jest.fn(),
    verifyPassword: jest.fn(),
    updateUserPassword: jest.fn(),
    updateUserEmail: jest.fn(),
  };

  const mockGoogleAuthService = {
    verifyGoogleToken: jest.fn(),
  };

  const mockJwtService = {
    generateAccessToken: jest.fn(),
  };

  const mockRefreshTokenService = {
    createRefreshToken: jest.fn(),
    validateRefreshToken: jest.fn(),
    revokeRefreshToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: FirebaseService, useValue: mockFirebaseService },
        { provide: GoogleAuthService, useValue: mockGoogleAuthService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: RefreshTokenService, useValue: mockRefreshTokenService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    const registerDto = {
      email: 'test@example.com',
      password: 'password123',
      nickname: 'TestUser',
    };

    it('should register a new user successfully', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockFirebaseService.createUser.mockResolvedValue('firebase-uid-123');
      mockPrismaService.user.create.mockResolvedValue({
        id: 'user-id-123',
        email: registerDto.email,
        nickname: registerDto.nickname,
        firebaseUid: 'firebase-uid-123',
      });
      mockJwtService.generateAccessToken.mockReturnValue('access-token');
      mockRefreshTokenService.createRefreshToken.mockResolvedValue({
        token: 'refresh-token',
      });

      // Act
      const result = await service.register(registerDto);

      // Assert
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(mockFirebaseService.createUser).toHaveBeenCalledWith(
        registerDto.email,
        registerDto.password,
        registerDto.nickname,
      );
      expect(mockPrismaService.user.create).toHaveBeenCalled();
      expect(result.access_token).toBe('access-token');
      expect(result.refresh_token).toBe('refresh-token');
      expect(result.user).toMatchObject({
        id: 'user-id-123',
        email: registerDto.email,
      });
    });

    it('should throw UserAlreadyExistsException if user exists in PG', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'existing-id',
        email: registerDto.email,
      });

      // Act & Assert
      await expect(service.register(registerDto)).rejects.toThrow(
        UserAlreadyExistsException,
      );
      expect(mockFirebaseService.createUser).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should login successfully and return tokens', async () => {
      // Arrange
      const firebaseUser = { uid: 'firebase-uid-123', email: loginDto.email };
      mockFirebaseService.verifyPasswordAndGetUser.mockResolvedValue(
        firebaseUser,
      );

      const dbUser = {
        id: 'user-id-123',
        email: loginDto.email,
        firebaseUid: 'firebase-uid-123',
        nickname: 'TestUser',
      };
      mockPrismaService.user.findUnique.mockResolvedValue(dbUser);

      mockJwtService.generateAccessToken.mockReturnValue('access-token');
      mockRefreshTokenService.createRefreshToken.mockResolvedValue({
        token: 'refresh-token',
      });

      // Act
      const result = await service.login(loginDto);

      // Assert
      expect(mockFirebaseService.verifyPasswordAndGetUser).toHaveBeenCalledWith(
        loginDto.email,
        loginDto.password,
      );
      expect(mockPrismaService.user.findUnique).toHaveBeenCalled();
      expect(result.access_token).toBe('access-token');
      expect(result.refresh_token).toBe('refresh-token');
      expect(result.user).toMatchObject({ id: dbUser.id });
    });

    it('should throw UnauthorizedException if firebase auth fails', async () => {
      mockFirebaseService.verifyPasswordAndGetUser.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('googleAuth', () => {
    const googleAuthDto = { credential: 'google-token-123' };
    const googleUser = {
      email: 'google@example.com',
      googleId: 'google-id-123',
      nickname: 'Google User',
      avatar: 'avatar.png',
    };

    it('should authenticate existing google user', async () => {
      // Arrange
      mockGoogleAuthService.verifyGoogleToken.mockResolvedValue(googleUser);

      const existingUser = {
        id: 'user-id-123',
        ...googleUser,
        firebaseUid: 'firebase-uid-123',
      };

      mockPrismaService.user.findFirst.mockResolvedValue(existingUser);
      mockPrismaService.user.update.mockResolvedValue(existingUser);
      mockJwtService.generateAccessToken.mockReturnValue('access-token');
      mockRefreshTokenService.createRefreshToken.mockResolvedValue({
        token: 'refresh-token',
      });

      // Act
      const result = await service.googleAuth(googleAuthDto);

      // Assert
      expect(mockGoogleAuthService.verifyGoogleToken).toHaveBeenCalledWith(
        googleAuthDto.credential,
      );
      expect(mockPrismaService.user.update).toHaveBeenCalled();
      expect(result.access_token).toBe('access-token');
    });

    it('should create new user if not exists', async () => {
      // Arrange
      mockGoogleAuthService.verifyGoogleToken.mockResolvedValue(googleUser);
      mockPrismaService.user.findFirst.mockResolvedValue(null); // User not in DB
      mockFirebaseService.userExists.mockResolvedValue(false);
      mockFirebaseService.createUserWithoutPassword.mockResolvedValue(
        'new-firebase-uid',
      );

      const newUser = {
        id: 'new-user-id',
        ...googleUser,
        firebaseUid: 'new-firebase-uid',
      };
      mockPrismaService.user.create.mockResolvedValue(newUser);
      mockJwtService.generateAccessToken.mockReturnValue('access-token');
      mockRefreshTokenService.createRefreshToken.mockResolvedValue({
        token: 'refresh-token',
      });

      // Act
      const result = await service.googleAuth(googleAuthDto);

      // Assert
      expect(mockFirebaseService.createUserWithoutPassword).toHaveBeenCalled();
      expect(mockPrismaService.user.create).toHaveBeenCalled();
      expect(result.user.id).toBe(newUser.id);
    });
  });

  describe('refreshToken', () => {
    const token = 'valid-refresh-token';

    it('should refresh tokens successfully', async () => {
      // Arrange
      const validationResult = {
        isValid: true,
        refreshToken: { id: 'token-id-1' },
        userId: 'user-id-123',
      };
      mockRefreshTokenService.validateRefreshToken.mockResolvedValue(
        validationResult,
      );

      const user = { id: 'user-id-123', email: 'test@example.com' };
      mockPrismaService.user.findUnique.mockResolvedValue(user);

      mockJwtService.generateAccessToken.mockReturnValue('new-access-token');
      mockRefreshTokenService.createRefreshToken.mockResolvedValue({
        token: 'new-refresh-token',
      });

      // Act
      const result = await service.refreshToken(token);

      // Assert
      expect(mockRefreshTokenService.revokeRefreshToken).toHaveBeenCalledWith(
        'token-id-1',
      );
      expect(result).toEqual({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
      });
    });

    it('should throw TokenRefreshFailedException if token is invalid', async () => {
      mockRefreshTokenService.validateRefreshToken.mockResolvedValue({
        isValid: false,
      });

      await expect(service.refreshToken(token)).rejects.toThrow(
        TokenRefreshFailedException,
      );
    });
  });
});
