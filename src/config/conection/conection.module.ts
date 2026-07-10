import { Global, Module } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Global()
@Module({
  imports: [],
  controllers: [],
  providers: [
    {
      provide: DataSource,
      inject: [],
      useFactory: async () => {
        try {
          const poolConection = new DataSource({
            type: 'postgres',
            host: String(process.env.DB_HOST),
            port: Number(process.env.DB_PORT),
            username: String(process.env.DB_USER),
            password: String(process.env.DB_PASSWORD),
            database: String(process.env.DB_NAME),
            entities: [],
            synchronize: true,
            ssl: false,
          });

          await poolConection.initialize();
          console.log('Base de datos conectada correctamente');
          return poolConection;
        } catch (error) {
          console.error('Error al conectar con la base de datos:', error);
          throw error;
        }
      },
    },
  ],
})
export class ConectionModule {}
