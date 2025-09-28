/**
 * Global HTTP Exception Filter
 *
 * Catches all HTTP exceptions and formats them according to our
 * standardized API response structure. This ensures that all errors
 * follow the same format regardless of where they originate.
 */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  ErrorResponse,
  ValidationErrorResponse,
} from '../dto/api-response.dto';
import { HTTP_ERROR_CODES } from '../constants/error-codes';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Get request ID from headers (set by ResponseInterceptor)
    const requestId = response.getHeader('X-Request-ID') as string;

    let status: number;
    let errorResponse: ErrorResponse;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // Handle validation errors (from class-validator)
      if (
        status === 400 &&
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const validationResponse = exceptionResponse as Record<string, unknown>;

        if (
          validationResponse.message &&
          Array.isArray(validationResponse.message)
        ) {
          // Multiple validation errors
          errorResponse = new ValidationErrorResponse(
            'multiple',
            'Multiple validation errors occurred',
            validationResponse.message.join(', '),
            requestId,
          );
        } else if (typeof validationResponse.message === 'string') {
          // Single validation error
          errorResponse = new ValidationErrorResponse(
            'unknown',
            validationResponse.message,
            validationResponse.message,
            requestId,
          );
        } else {
          // Generic bad request
          errorResponse = new ErrorResponse(
            {
              code: HTTP_ERROR_CODES.BAD_REQUEST,
              message: exception.message || 'Bad request',
            },
            'Bad request',
            requestId,
          );
        }
      } else {
        // Other HTTP exceptions
        errorResponse = new ErrorResponse(
          {
            code: this.getErrorCode(status),
            message: exception.message || 'An error occurred',
          },
          exception.message || 'An error occurred',
          requestId,
        );
      }
    } else {
      // Non-HTTP exceptions (unexpected errors)
      status = HttpStatus.INTERNAL_SERVER_ERROR;

      this.logger.error('Unexpected error occurred:', exception);

      errorResponse = new ErrorResponse(
        {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
          // Include stack trace only in development
          ...(process.env.NODE_ENV === 'development' && {
            stack:
              exception instanceof Error ? exception.stack : String(exception),
          }),
        },
        'Internal server error',
        requestId,
      );
    }

    // Log the error for monitoring
    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${errorResponse.error?.message}`,
      {
        requestId,
        method: request.method,
        url: request.url,
        statusCode: status,
        userAgent: request.get('User-Agent'),
        ip: request.ip,
      },
    );

    response.status(status).json(errorResponse);
  }

  private getErrorCode(status: number): string {
    const errorCodes: Record<number, string> = {
      400: HTTP_ERROR_CODES.BAD_REQUEST,
      401: HTTP_ERROR_CODES.UNAUTHORIZED,
      403: HTTP_ERROR_CODES.FORBIDDEN,
      404: HTTP_ERROR_CODES.NOT_FOUND,
      409: HTTP_ERROR_CODES.CONFLICT,
      422: HTTP_ERROR_CODES.UNPROCESSABLE_ENTITY,
      429: HTTP_ERROR_CODES.TOO_MANY_REQUESTS,
      500: HTTP_ERROR_CODES.INTERNAL_SERVER_ERROR,
      502: HTTP_ERROR_CODES.BAD_GATEWAY,
      503: HTTP_ERROR_CODES.SERVICE_UNAVAILABLE,
    };

    return errorCodes[status] || `HTTP_${status}`;
  }
}
