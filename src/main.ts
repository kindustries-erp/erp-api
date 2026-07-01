import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import * as pg from 'pg';

// Parse TIMESTAMP WITHOUT TIME ZONE as UTC instead of local time
pg.types.setTypeParser(1114, (str) => new Date(str + 'Z'));

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Global prefix: tất cả route sẽ có dạng /api/v1/...
  app.setGlobalPrefix('api/v1');

  // Cấu hình Global Exception Filter để bắt chi tiết lỗi 500 (VD: TypeORM crashes)
  app.useGlobalFilters(new AllExceptionsFilter());

  // Kích hoạt CORS (điều chỉnh origin cho production)
  app.enableCors();

  // Tự động validate & transform DTO dựa theo class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Loại bỏ các field không khai báo trong DTO
      forbidNonWhitelisted: true,
      transform: true, // Tự convert kiểu dữ liệu (string → number, v.v.)
    }),
  );

  const port = process.env.PORT ?? 3000;

  // Cấu hình Swagger UI
  const config = new DocumentBuilder()
    .setTitle('ERP API Backend')
    .setDescription('Tài liệu API cho hệ thống ERP Greenway')
    .setVersion('1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'Authorization',
      in: 'header',
      description:
        'Nhập access_token nhận được từ /api/v1/auth/login. Swagger sẽ tự thêm tiền tố Bearer.',
    })
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(port);
  logger.log(`🚀 Swagger UI đang chạy tại http://localhost:${port}/api/docs`);
  logger.log(`🚀 Server đang chạy tại http://localhost:${port}/api/v1`);
}
void bootstrap();
