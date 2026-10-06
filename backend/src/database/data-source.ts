import 'reflect-metadata';
import { DataSource } from 'typeorm';

// Source de données utilisée par la CLI TypeORM (migrations).
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: ['src/modules/**/entities/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
});
