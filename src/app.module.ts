import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConectionModule } from './config/conection/conection.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), ConectionModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
