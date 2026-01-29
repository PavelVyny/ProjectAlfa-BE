/**
 * Authentication-specific exceptions
 *
 * These exceptions provide more semantic meaning and use centralized error codes
 * instead of generic HttpException with hardcoded messages.
 */

import {
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AUTH_ERROR_CODES } from '../constants/error-codes';

// Invalid credentials exception
export class InvalidCredentialsException extends UnauthorizedException {
  constructor() {
    super({
      code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
      message: 'Invalid email or password',
    });
  }
}

// User not found exception
export class UserNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: AUTH_ERROR_CODES.USER_NOT_FOUND,
      message: 'User not found',
    });
  }
}

// User already exists exception
export class UserAlreadyExistsException extends ConflictException {
  constructor(email?: string) {
    super({
      code: AUTH_ERROR_CODES.USER_ALREADY_EXISTS,
      message: email
        ? `User with email ${email} already exists`
        : 'User already exists',
    });
  }
}

// Invalid token exception
export class InvalidTokenException extends UnauthorizedException {
  constructor() {
    super({
      code: AUTH_ERROR_CODES.INVALID_TOKEN,
      message: 'Invalid or malformed token',
    });
  }
}

// Expired token exception
export class ExpiredTokenException extends UnauthorizedException {
  constructor() {
    super({
      code: AUTH_ERROR_CODES.EXPIRED_TOKEN,
      message: 'Token has expired',
    });
  }
}

// Invalid refresh token exception
export class InvalidRefreshTokenException extends UnauthorizedException {
  constructor() {
    super({
      code: AUTH_ERROR_CODES.INVALID_REFRESH_TOKEN,
      message: 'Invalid or expired refresh token',
    });
  }
}

// Token refresh failed exception
export class TokenRefreshFailedException extends UnauthorizedException {
  constructor() {
    super({
      code: AUTH_ERROR_CODES.TOKEN_REFRESH_FAILED,
      message: 'Failed to refresh token',
    });
  }
}

// User inactive exception
export class UserInactiveException extends UnauthorizedException {
  constructor() {
    super({
      code: AUTH_ERROR_CODES.USER_INACTIVE,
      message: 'User account is inactive',
    });
  }
}

// Google authentication failed exception
export class GoogleAuthFailedException extends UnauthorizedException {
  constructor() {
    super({
      code: AUTH_ERROR_CODES.GOOGLE_AUTH_FAILED,
      message: 'Google authentication failed',
    });
  }
}

// Google token invalid exception
export class GoogleTokenInvalidException extends UnauthorizedException {
  constructor() {
    super({
      code: AUTH_ERROR_CODES.GOOGLE_TOKEN_INVALID,
      message: 'Invalid Google token',
    });
  }
}
