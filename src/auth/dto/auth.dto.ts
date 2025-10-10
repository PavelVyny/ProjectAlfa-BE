import { IsEmail, IsString, MinLength, MaxLength, IsOptional } from 'class-validator';

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

export class AuthResponseDto {
  access_token: string;
  user: {
    id: string;
    email: string;
    nickname?: string;
    avatar?: string;
    googleId?: string;
  };
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