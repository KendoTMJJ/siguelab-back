import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('periodo_academico')
export class PeriodoAcademico {
  @PrimaryGeneratedColumn({ name: 'id_periodo' })
  idPeriodo!: number;

  @Column({ length: 20 })
  nombre!: string;

  /** Ver comentario equivalente en Division.nombreActivo. */
  @Column({
    name: 'nombre_activo',
    type: 'varchar',
    length: 20,
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

  @Column({ name: 'fecha_inicio', type: 'date' })
  fechaInicio!: string;

  @Column({ name: 'fecha_fin', type: 'date' })
  fechaFin!: string;

  @Column({ name: 'num_semanas', default: 16 })
  numSemanas!: number;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion!: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fechaActualizacion!: Date;

  @DeleteDateColumn({ name: 'fecha_eliminacion' })
  fechaEliminacion!: Date | null;
}
