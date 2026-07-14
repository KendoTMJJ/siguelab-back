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

  @Column({ length: 255, select: false })
  contrasena!: string;

  @Column({
    type: 'enum',
    enum: EstadoUsuario,
    default: EstadoUsuario.ACTIVO,
  })
  estado!: EstadoUsuario;

  @Column({ name: 'correo_verificado', default: false })
  correoVerificado!: boolean;

  @Column({ name: 'intentos_fallidos', default: 0 })
  intentosFallidos!: number;

  @Column({ name: 'bloqueado_hasta', type: 'timestamp', nullable: true })
  bloqueadoHasta!: Date | null;

  @Column({ name: 'token_version', default: 0 })
  tokenVersion!: number;

  @CreateDateColumn({ name: 'fecha_registro' })
  fechaRegistro!: Date;

  @DeleteDateColumn({ name: 'fecha_eliminacion' })
  fechaEliminacion!: Date | null;
}
