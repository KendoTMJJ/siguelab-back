import { DataSource } from 'typeorm';
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

/**
 * Pre-crea el admin por correo, SIN oid: no puede "loguearse" hasta que esa
 * persona entre por primera vez con Microsoft — ahí JwtStrategy engancha el
 * oid a esta fila (ver UsuariosService.findOrCreateByOid). Sin esto, nadie
 * podría asignar el primer rol admin del sistema.
 */
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
    estado: EstadoUsuario.ACTIVO,
    rol: roles['admin'],
  });

  await usuarioRepository.save(usuario);
  console.log(
    'Admin creado correctamente (pendiente de vincular con su primer login de Entra).',
  );
}

interface UsuarioDemo {
  nombre: string;
  correo: string;
  rol: string;
}

/**
 * Solo para desarrollo/pruebas: pre-crea una fila por rol no-admin, SIN oid
 * (igual que seedAdmin) — sirve para poder asignarle un rol de entrada a
 * una cuenta institucional real antes de su primer login. Si no tienes
 * cuentas reales para probar cada rol, estas filas simplemente quedan sin
 * vincular y no estorban.
 */
const USUARIOS_DEMO: UsuarioDemo[] = [
  { nombre: 'Estudiante', correo: 'e@usantoto.edu.co', rol: 'estudiante' },
  { nombre: 'Docente', correo: 'd@usantoto.edu.co', rol: 'docente' },
  {
    nombre: 'Laboratorista',
    correo: 'l@usantoto.edu.co',
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
      estado: EstadoUsuario.ACTIVO,
      rol: roles[demo.rol],
    });

    await usuarioRepository.save(usuario);
    console.log(`Usuario demo (${demo.rol}) pre-creado: ${demo.correo}`);
  }
}
