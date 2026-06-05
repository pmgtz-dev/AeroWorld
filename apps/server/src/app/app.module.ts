import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AewoModule } from '../aeroworld/aewo.module';
import { APP_FILTER } from "@nestjs/core";
import { ApiExceptionFilter } from "../common/exceptions/ApiException.filter";
import { RealtimeModule } from "../realtime/realtime.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,   
    }),

TypeOrmModule.forRoot({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  autoLoadEntities: true,
  synchronize: true,
}),
    AuthModule,
    AewoModule,
    RealtimeModule,
    

  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: ApiExceptionFilter,
    },
  ],
})
export class AppModule {}