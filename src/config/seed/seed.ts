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

interface UsuarioDemo {
  nombre: string;
  correo: string;
  contrasena: string;
  rol: string;
}

/** Solo para desarrollo/pruebas: un usuario por cada rol no-admin. */
const USUARIOS_DEMO: UsuarioDemo[] = [
  {
    nombre: 'Estudiante',
    correo: 'e@usantoto.edu.co',
    contrasena: '12345678',
    rol: 'estudiante',
  },
  {
    nombre: 'Docente',
    correo: 'd@usantoto.edu.co',
    contrasena: '12345678',
    rol: 'docente',
  },
  {
    nombre: 'Laboratorista',
    correo: 'l@usantoto.edu.co',
    contrasena: '12345678',
    rol: 'laboratorista',
  },
];

export async function seedUsuariosDemo(dataSource: DataSource): Promise<void> {
  const rolRepository = dataSource.getRepository(Rol);
  const usuarioRepository = dataSource.getRepository(Usuario);

  const roles = await seedRoles(rolRepository);

  for (const demo of USUARIOS_DEMO) {
    const existente = await usuarioRepository.findOne({
      where: { correo: demo.correo },
    });
    if (existente) {
      continue;
    }

    const usuario = usuarioRepository.create({
      nombre: demo.nombre,
      correo: demo.correo,
      contrasena: await bcrypt.hash(demo.contrasena, 10),
      estado: EstadoUsuario.ACTIVO,
      correoVerificado: true,
      rol: roles[demo.rol],
    });

    await usuarioRepository.save(usuario);
    console.log(`Usuario demo (${demo.rol}) creado: ${demo.correo}`);
  }
}
