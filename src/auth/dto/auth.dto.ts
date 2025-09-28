import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  firstName?: string;

  @IsString()
  lastName?: string;
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
