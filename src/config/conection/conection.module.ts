import { Global, Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { seedAdmin, seedUsuariosDemo } from '../seed/seed';
import { seedCatalogos } from '../../catalogos/seed/catalogos.seed';
import { seedLaboratorios } from '../../laboratorios/seed/laboratorios.seed';

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
            type: 'mariadb',
            host: String(process.env.DB_HOST),
            port: Number(process.env.DB_PORT),
            username: String(process.env.DB_USER),
            password: String(process.env.DB_PASSWORD),
            database: String(process.env.DB_NAME),
            entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
            synchronize: true,
            ssl: false,
          });

          await poolConection.initialize();
          console.log('Base de datos conectada correctamente');
          await seedAdmin(poolConection);
          await seedUsuariosDemo(poolConection);
          await seedCatalogos(poolConection);
          await seedLaboratorios(poolConection);
          return poolConection;
        } catch (error) {
          console.error('Error al conectar con la base de datos:', error);
          throw error;
        }
      },
    },
  ],
  exports: [DataSource],
})
export class ConectionModule {}
