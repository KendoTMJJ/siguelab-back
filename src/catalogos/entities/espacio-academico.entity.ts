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

  @Column({ length: 150 })
  nombre!: string;

  /** Ver comentario equivalente en Division.nombreActivo. */
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

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion!: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fechaActualizacion!: Date;

  @DeleteDateColumn({ name: 'fecha_eliminacion' })
  fechaEliminacion!: Date | null;
}
