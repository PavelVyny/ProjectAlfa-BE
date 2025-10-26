import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Nickname must be at least 2 characters long' })
  @MaxLength(50, { message: 'Nickname must not exceed 50 characters' })
  nickname?: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

export class GoogleAuthDto {
  @IsString()
  credential: string; // JWT токен от Google
}

// Request DTO for refresh token endpoint
export class RefreshTokenRequestDto {
  @IsString()
  refresh_token: string;
}

// User data structure for responses
export interface UserData {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
}

// Authentication data for successful auth responses
export interface AuthData {
  access_token: string;
  refresh_token: string;
  user: UserData;
}

// Refresh token data for refresh responses
export interface RefreshTokenData {
  access_token: string;
  refresh_token: string;
}

// Response types - interceptor will wrap these in ApiResponse format
export type AuthResponseDto = AuthData;
export type RefreshTokenResponseDto = RefreshTokenData;
export type LogoutResponseDto = { message: string };

// Request DTO for logout endpoint
export class LogoutDto {
  @IsString()
  refresh_token: string;
}

export class SendPasswordResetDto {
  @IsEmail()
  email: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(6)
  newPassword: string;
}

export class ChangePasswordResponseDto {
  message: string;
}
