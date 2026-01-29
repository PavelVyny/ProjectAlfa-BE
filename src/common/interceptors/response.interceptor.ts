/**
 * Response Interceptor
 *
 * Automatically formats all API responses to follow the standardized format.
 * This interceptor wraps successful responses in the ApiResponse structure
 * and ensures consistent response formatting across the application.
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request, Response } from 'express';
import {
  SuccessResponse,
  ResponseMessages,
  ApiResponse,
} from '../dto/api-response.dto';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Generate request ID for tracing
    const requestId = this.generateRequestId();

    // Add request ID to response headers
    response.setHeader('X-Request-ID', requestId);

    const startTime = Date.now();

    return next.handle().pipe(
      map((data: unknown) => {
        const executionTime = Date.now() - startTime;

        // If data is already in ApiResponse format, return as-is
        if (data && typeof data === 'object' && 'success' in data) {
          const apiResponse = data as ApiResponse;
          return {
            ...apiResponse,
            requestId,
            meta: {
              ...apiResponse.meta,
              executionTime,
            },
          };
        }

        // Determine the appropriate success message based on HTTP method and status
        const message = this.getSuccessMessage(
          request.method,
          response.statusCode,
        );

        // Wrap the response in standardized format
        return new SuccessResponse(
          data,
          message,
          {
            executionTime,
          },
          requestId,
        );
      }),
    );
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getSuccessMessage(method: string, statusCode: number): string {
    // Handle specific auth endpoints
    const path = method.toLowerCase();

    switch (statusCode) {
      case 200:
        if (path.includes('login')) return ResponseMessages.LOGIN_SUCCESS;
        if (path.includes('refresh'))
          return ResponseMessages.TOKEN_REFRESH_SUCCESS;
        if (path.includes('logout')) return ResponseMessages.LOGOUT_SUCCESS;
        return ResponseMessages.RETRIEVED;

      case 201:
        if (path.includes('register')) return ResponseMessages.REGISTER_SUCCESS;
        return ResponseMessages.CREATED;

      case 204:
        return ResponseMessages.DELETED;

      default:
        return ResponseMessages.RETRIEVED;
    }
  }
}
