import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('espacio_academico')
export class EspacioAcademico {
  @PrimaryGeneratedColumn({ name: 'id_espacio' })
  idEspacio!: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  codigo?: string | null;

  /** Ver comentario equivalente en Division.nombreActivo. */
  @Column({
    name: 'codigo_activo',
    type: 'varchar',
    length: 20,
    nullable: true,
    unique: true,
    insert: false,
    update: false,
    select: false,
    generatedType: 'VIRTUAL',
    asExpression:
      'CASE WHEN fecha_eliminacion IS NULL THEN codigo ELSE NULL END',
  })
  codigoActivo?: string | null;

  @Column({ length: 150 })
  nombre!: string;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion!: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fechaActualizacion!: Date;

  @DeleteDateColumn({ name: 'fecha_eliminacion' })
  fechaEliminacion!: Date | null;
}
