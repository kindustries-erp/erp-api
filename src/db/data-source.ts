import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { CoreUser } from '../users/entities/core-user.entity';

const databaseUrl = process.env.DATABASE_URL;

export default new DataSource(
  databaseUrl
    ? {
        type: 'postgres',
        url: databaseUrl,
        entities: [CoreUser],
        migrations: [__dirname + '/../migrations/**/*.js'],
        synchronize: false,
        ssl: { rejectUnauthorized: false },
      }
    : {
        type: 'postgres',
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 5432),
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_DATABASE || 'erp_core',
        entities: [CoreUser],
        migrations: [__dirname + '/../migrations/**/*.js'],
        synchronize: false,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      },
);
