import { DataSource } from 'typeorm';
import { Rol } from 'src/roles/entities/rol.entity';

const ROLES_BASE = ['admin', 'laboratorista', 'docente', 'estudiante'];

export async function seedRoles(dataSource: DataSource): Promise<void> {
  const rolRepository = dataSource.getRepository(Rol);

  for (const nombre of ROLES_BASE) {
    const existente = await rolRepository.findOne({ where: { nombre } });
    if (!existente) {
      await rolRepository.save(rolRepository.create({ nombre }));
      console.log(`Rol ${nombre} creado.`);
    }
  }
}
