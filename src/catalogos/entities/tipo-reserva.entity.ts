import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('tipo_reserva')
export class TipoReserva {
  @PrimaryGeneratedColumn({ name: 'id_tipo' })
  idTipo!: number;

  @Column({ length: 80 })
  nombre!: string;

  /** Ver comentario equivalente en Division.nombreActivo. */
  @Column({
    name: 'nombre_activo',
    type: 'varchar',
    length: 80,
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

  /**
   * Docencia bloquea el laboratorio completo; los demás tipos comparten
   * aforo con otras reservas simultáneas.
   */
  @Column({ name: 'es_exclusiva', default: false })
  esExclusiva!: boolean;

  /** Obliga a elegir un espacio académico al crear la solicitud. */
  @Column({ name: 'requiere_espacio', default: false })
  requiereEspacio!: boolean;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion!: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fechaActualizacion!: Date;

  @DeleteDateColumn({ name: 'fecha_eliminacion' })
  fechaEliminacion!: Date | null;
}
