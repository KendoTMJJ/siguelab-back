import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Rol } from 'src/roles/entities/rol.entity';
import { Usuario, EstadoUsuario } from 'src/usuarios/entities/usuario.entity';

const ROLES_BASE = ['admin', 'laboratorista', 'docente', 'estudiante'];

async function seedRoles(rolRepository: import('typeorm').Repository<Rol>) {
  const roles: Record<string, Rol> = {};

  for (const nombre of ROLES_BASE) {
    let rol = await rolRepository.findOne({ where: { nombre } });
    if (!rol) {
      rol = await rolRepository.save(rolRepository.create({ nombre }));
      console.log(`Rol ${nombre} creado.`);
    }
    roles[nombre] = rol;
  }

  return roles;
}

export async function seedAdmin(dataSource: DataSource): Promise<void> {
  const rolRepository = dataSource.getRepository(Rol);
  const usuarioRepository = dataSource.getRepository(Usuario);

  const roles = await seedRoles(rolRepository);

  const existente = await usuarioRepository.findOne({
    where: { correo: String(process.env.SEED_ADMIN_EMAIL) },
  });

  if (existente) {
    console.log('Admin ya existe, omitiendo seed.');
    return;
  }

  const usuario = usuarioRepository.create({
    nombre: String(process.env.SEED_ADMIN_NAME),
    correo: String(process.env.SEED_ADMIN_EMAIL),
    contrasena: await bcrypt.hash(String(process.env.SEED_ADMIN_PASSWORD), 10),
    estado: EstadoUsuario.ACTIVO,
    correoVerificado: true,
    rol: roles['admin'],
  });

  await usuarioRepository.save(usuario);
  console.log('Admin creado correctamente.');
}
