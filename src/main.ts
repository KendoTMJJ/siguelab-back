import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const port: number = Number(process.env.PORT);
  const app = await NestFactory.create(AppModule);
  await app.listen(port, () => {
    console.log('Servidor escuchando el puerto', port);
  });
}
bootstrap();
