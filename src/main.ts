import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Включаем валидацию
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Настраиваем CORS для продакшена и разработки
  const allowedOrigins = [
    'http://localhost:3000', // Фронтенд разработка
    'http://localhost:3001', // Бэкенд разработка
    'https://project-alfa-fe-two.vercel.app', // Продакшен фронтенд
  ];
  
  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
  });

  const port = process.env.PORT || 3001;
  const host = '0.0.0.0'; 
  
  console.log(`🚀 Application starting on ${host}:${port}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Database URL: ${process.env.DATABASE_URL ? 'Set' : 'Not set'}`);
  console.log(`🔥 Firebase Project: ${process.env.FIREBASE_PROJECT_ID || 'Not set'}`);
  
  await app.listen(port, host);
  console.log(`✅ Application is running on ${host}:${port}`);
  console.log(`🌐 Server ready to accept connections`);
}

bootstrap().catch((error) => {
  console.error('❌ Failed to start application:', error);
  process.exit(1);
});
