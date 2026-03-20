import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable cookie parsing for httpOnly cookies
  app.use(cookieParser());

  // Enable global response formatting and error handling
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      const allowed = [
        'http://localhost:3001',
        'https://project-alfa-fe-two.vercel.app',
      ];
      if (
        !origin ||
        allowed.includes(origin) ||
        /\.vercel\.app$/.test(origin)
      ) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked: ${origin}`));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
  });

  const port = process.env.PORT || 4000;
  const host = '0.0.0.0';

  console.log(`🚀 Application starting on ${host}:${port}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(
    `🔗 Database URL: ${process.env.DATABASE_URL ? 'Set' : 'Not set'}`,
  );
  console.log(
    `🔥 Firebase Project: ${process.env.FIREBASE_PROJECT_ID || 'Not set'}`,
  );

  await app.listen(port, host);
  console.log(`✅ Application is running on ${host}:${port}`);
  console.log(`🌐 Server ready to accept connections`);
}

bootstrap().catch((error) => {
  console.error('❌ Failed to start application:', error);
  process.exit(1);
});
