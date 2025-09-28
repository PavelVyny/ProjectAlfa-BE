import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
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
} from './dto/auth.dto';
import {
  InvalidCredentialsException,
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
    const { email, password, firstName, lastName } = registerDto;

    // Step 1: Check if user already exists in PostgreSQL
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new UserAlreadyExistsException(email);
    }

    try {
      // Step 2: Create user in Firebase
      let firebaseUid: string | null = null;
      try {
        const firebaseUserRecord = await this.firebaseService.createUser(
          email,
          password,
          firstName && lastName ? `${firstName} ${lastName}` : undefined,
        );
        firebaseUid = firebaseUserRecord;
        console.log(`✅ User created in Firebase with UID: ${firebaseUid}`);
      } catch (firebaseError) {
        console.warn('⚠️ Failed to create user in Firebase:', firebaseError);
        // Continue without Firebase - we'll still create in PostgreSQL
      }

      // Step 3: Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Step 4: Create user in PostgreSQL
      const user = await this.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          firebaseUid,
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
        });

      return {
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName || undefined,
          lastName: user.lastName || undefined,
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

    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new InvalidCredentialsException();
    }

    // Check password (only if user is not a Google user)
    if (!user.password) {
      throw new InvalidCredentialsException();
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new InvalidCredentialsException();
    }

    // Generate tokens (access + refresh)
    const payload = { email: user.email, sub: user.id };
    const accessToken = this.jwtService.generateAccessToken(payload);

    // Create refresh token
    const { token: refreshToken } =
      await this.refreshTokenService.createRefreshToken({
        userId: user.id,
      });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
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
    return user;
  }

  async googleAuth(googleAuthDto: GoogleAuthDto): Promise<AuthResponseDto> {
    const { credential } = googleAuthDto;

    try {
      // Step 1: Verify Google credential and get user info
      const googleUser =
        await this.googleAuthService.verifyGoogleToken(credential);

      console.log('✅ Google user verified:', {
        email: googleUser.email,
        name: `${googleUser.firstName} ${googleUser.lastName}`,
      });

      // Step 2: Check if user exists in our database
      let user = await this.prisma.user.findFirst({
        where: {
          OR: [{ email: googleUser.email }, { googleId: googleUser.googleId }],
        },
      });

      // Step 3: Create user if doesn't exist
      if (!user) {
        console.log('👤 Creating new Google user in database...');

        // Try to create Firebase user (optional)
        let firebaseUid: string | null = null;
        try {
          const firebaseUserRecord = await this.firebaseService.createUser(
            googleUser.email,
            '', // Empty password for Google users
            `${googleUser.firstName} ${googleUser.lastName}`,
          );
          firebaseUid = firebaseUserRecord;
          console.log(
            `✅ Google user created in Firebase with UID: ${firebaseUid}`,
          );
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
            firstName: googleUser.firstName,
            lastName: googleUser.lastName,
            avatar: googleUser.avatar,
            firebaseUid, // Link to Firebase UID if successful
            // password remains null for Google users
          },
        });

        console.log(`✅ Google user created in PostgreSQL with ID: ${user.id}`);
      }

      // Generate tokens (access + refresh)
      const payload = { email: user.email, sub: user.id };
      const accessToken = this.jwtService.generateAccessToken(payload);

      // Create refresh token
      const { token: refreshToken } =
        await this.refreshTokenService.createRefreshToken({
          userId: user.id,
        });

      return {
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName || undefined,
          lastName: user.lastName || undefined,
          avatar: user.avatar || undefined,
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
}
