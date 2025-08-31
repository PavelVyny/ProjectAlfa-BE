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

  // Настраиваем CORS для продакшена
  app.enableCors({
    origin: ['*'], // Разрешаем все источники
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: false, // Отключаем для продакшена
  });

  const port = process.env.PORT || 3001;
  console.log(`Application starting on port ${port}`);
  await app.listen(port); // Убираем '0.0.0.0' для Cloud Run
  console.log(`Application is running on port ${port}`);
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
