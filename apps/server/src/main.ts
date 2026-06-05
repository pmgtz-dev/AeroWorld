/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */
import * as dotenv from 'dotenv';
import { join } from 'path';

const envFile = process.env.DOCKER_ENV === 'yes' ? '.env': '.env.local';
dotenv.config({ path: join(process.cwd(), envFile), override: true,});

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import cookieParser from "cookie-parser";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = '';
  app.setGlobalPrefix(globalPrefix);

  app.use(cookieParser());

  const port = process.env.API_PORT || 5000;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`
  );
}

bootstrap();
