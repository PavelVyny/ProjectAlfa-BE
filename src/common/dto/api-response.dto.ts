/**
 * Standardized API Response Types
 *
 * This file defines the standard format for all API responses
 * to ensure consistency across the entire application.
 */

import { VALIDATION_ERROR_CODES } from '../constants/error-codes';

// Base API Response structure
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
  timestamp: string;
  requestId?: string;
}

// Error structure for failed responses
export interface ApiError {
  code: string;
  message: string;
  details?: string;
  field?: string; // For validation errors
  stack?: string; // Only in development
}

// Metadata for responses (pagination, etc.)
export interface ApiMeta {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  version?: string;
  executionTime?: number; // in milliseconds
}

// Success response helper
export class SuccessResponse<T> implements ApiResponse<T> {
  success = true;
  timestamp: string;

  constructor(
    public data: T,
    public message: string = 'Operation successful',
    public meta?: ApiMeta,
    public requestId?: string,
  ) {
    this.timestamp = new Date().toISOString();
  }
}

// Error response helper
export class ErrorResponse implements ApiResponse {
  success = false;
  timestamp: string;

  constructor(
    public error: ApiError,
    public message: string = 'Operation failed',
    public requestId?: string,
  ) {
    this.timestamp = new Date().toISOString();
  }
}

// Validation error response helper
export class ValidationErrorResponse extends ErrorResponse {
  constructor(
    field: string,
    message: string,
    details?: string,
    requestId?: string,
  ) {
    super(
      {
        code: VALIDATION_ERROR_CODES.VALIDATION_ERROR,
        message,
        field,
        details,
      },
      'Validation failed',
      requestId,
    );
  }
}

// Authentication error response helper
export class AuthErrorResponse extends ErrorResponse {
  constructor(
    message: string = 'Authentication failed',
    code: string = 'AUTH_ERROR',
    requestId?: string,
  ) {
    super(
      {
        code,
        message,
      },
      message,
      requestId,
    );
  }
}

// Pagination helper
export class PaginatedResponse<T> extends SuccessResponse<T[]> {
  constructor(
    data: T[],
    page: number,
    limit: number,
    total: number,
    message: string = 'Data retrieved successfully',
    requestId?: string,
  ) {
    const totalPages = Math.ceil(total / limit);

    super(
      data,
      message,
      {
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      },
      requestId,
    );
  }
}

// Common response messages
export const ResponseMessages = {
  // Authentication
  LOGIN_SUCCESS: 'User logged in successfully',
  REGISTER_SUCCESS: 'User registered successfully',
  LOGOUT_SUCCESS: 'User logged out successfully',
  TOKEN_REFRESH_SUCCESS: 'Token refreshed successfully',

  // Generic
  CREATED: 'Resource created successfully',
  UPDATED: 'Resource updated successfully',
  DELETED: 'Resource deleted successfully',
  RETRIEVED: 'Data retrieved successfully',

  // Errors
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Access forbidden',
  NOT_FOUND: 'Resource not found',
  VALIDATION_FAILED: 'Validation failed',
  INTERNAL_ERROR: 'Internal server error',
} as const;

// HTTP Status codes mapping
export const HttpStatusMessages = {
  200: 'OK',
  201: 'Created',
  204: 'No Content',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  500: 'Internal Server Error',
} as const;
