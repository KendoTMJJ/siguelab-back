import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum EstadoLaboratorio {
  ACTIVO = 'activo',
  INACTIVO = 'inactivo',
}

@Entity('laboratorio')
export class Laboratorio {
  @PrimaryGeneratedColumn({ name: 'id_laboratorio' })
  idLaboratorio!: number;

  @Column({ length: 150 })
  nombre!: string;

  /** Ver comentario equivalente en el resto de catálogos (nombreActivo/codigoActivo). */
  @Column({
    name: 'nombre_activo',
    type: 'varchar',
    length: 150,
    nullable: true,
    unique: true,
    insert: false,
    update: false,
    select: false,
    generatedType: 'VIRTUAL',
    asExpression:
      'CASE WHEN fecha_eliminacion IS NULL THEN nombre ELSE NULL END',
  })
  nombreActivo?: string | null;

  /** Aforo del laboratorio; la lógica de consumo de cupos vive en el módulo de solicitudes. */
  @Column({ type: 'int' })
  capacidad!: number;

  @Column({ type: 'varchar', length: 150, nullable: true })
  ubicacion?: string | null;

  @Column({
    type: 'enum',
    enum: EstadoLaboratorio,
    default: EstadoLaboratorio.ACTIVO,
  })
  estado!: EstadoLaboratorio;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion!: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fechaActualizacion!: Date;

  @DeleteDateColumn({ name: 'fecha_eliminacion' })
  fechaEliminacion!: Date | null;
}
