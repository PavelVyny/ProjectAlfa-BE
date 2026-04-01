import { IsEmail, IsString, MinLength } from 'class-validator';

// Login request DTO
export class AdminLoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}

// Refresh token request DTO
export class AdminRefreshTokenRequestDto {
  @IsString()
  refresh_token: string;
}

// Logout request DTO
export class AdminLogoutDto {
  @IsString()
  refresh_token: string;
}

// Admin data structure for responses
export interface AdminData {
  id: string;
  email: string;
  name: string;
}

// Auth response data
export interface AdminAuthData {
  access_token: string;
  refresh_token: string;
  admin: AdminData;
}

// Refresh token response data
export interface AdminRefreshTokenData {
  access_token: string;
  refresh_token: string;
}

// Response types
export type AdminAuthResponseDto = AdminAuthData;
export type AdminRefreshTokenResponseDto = AdminRefreshTokenData;
export type AdminLogoutResponseDto = { message: string };
