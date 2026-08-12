import { Rol } from 'src/roles/entities/rol.entity';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum EstadoUsuario {
  ACTIVO = 'activo',
  INACTIVO = 'inactivo',
}

@Entity('usuario')
export class Usuario {
  @PrimaryGeneratedColumn('uuid', { name: 'id_usuario' })
  idUsuario!: string;

  @ManyToOne(() => Rol)
  @JoinColumn({ name: 'id_rol' })
  rol!: Rol;

  @Column({ length: 150 })
  nombre!: string;

  @Column({ length: 150, unique: true })
  correo!: string;

  /**
   * Identificador estable de Microsoft Entra ID (claim `oid` del token).
   * Nullable: un admin puede pre-crear el usuario por correo (para poder
   * asignarle rol de entrada) antes de que esa persona inicie sesión por
   * primera vez — el `oid` se enlaza automáticamente en su primer login
   * (ver UsuariosService.findOrCreateByOid).
   */
  @Column({ type: 'varchar', length: 100, unique: true, nullable: true })
  oid?: string | null;

  /**
   * Cargo y facultad del directorio institucional (jobTitle/department en
   * Microsoft Graph). El backend nunca llama a Graph: el frontend los trae
   * con un token de scope User.Read y los sincroniza vía PATCH /directorio/me
   * (ver DirectorioModule) — así este backend no necesita client secret.
   */
  @Column({ type: 'varchar', length: 150, nullable: true })
  cargo?: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  facultad?: string | null;

  @Column({
    type: 'enum',
    enum: EstadoUsuario,
    default: EstadoUsuario.ACTIVO,
  })
  estado!: EstadoUsuario;

  @CreateDateColumn({ name: 'fecha_registro' })
  fechaRegistro!: Date;

  @DeleteDateColumn({ name: 'fecha_eliminacion' })
  fechaEliminacion!: Date | null;
}
