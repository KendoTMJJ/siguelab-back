import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { corsConfig } from './config/cors/cors.config';
import { setupSwagger } from './config/swagger/swagger.config';

async function bootstrap() {
  const port: number = Number(process.env.PORT);
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.use(cookieParser());

  app.enableCors(corsConfig);
  setupSwagger(app);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(port, () => {
    console.log('Servidor escuchando el puerto', port);
  });
}
void bootstrap();
