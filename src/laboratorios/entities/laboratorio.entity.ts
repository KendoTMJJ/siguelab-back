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

/**
 * Determina a qué flujo de reserva manda el frontend al elegir este
 * laboratorio: 'estandar' usa SolicitudReserva/Firma (franjas, aforo por
 * personas); 'laboratorio_como_servicio' usa el módulo de equipos/servicios
 * tecnológicos/eventos (reserva por equipo individual, sin firmas). No es
 * exclusivo del laboratorio "Fabricación Digital" — cualquier laboratorio
 * puede nacer o pasar a este modo.
 */
export enum ModoReservaLaboratorio {
  ESTANDAR = 'estandar',
  LABORATORIO_COMO_SERVICIO = 'laboratorio_como_servicio',
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

  /**
   * Aforo del laboratorio; la lógica de consumo de cupos vive en el módulo de
   * solicitudes. Solo aplica en modo 'estandar' — nullable porque en modo
   * 'laboratorio_como_servicio' la disponibilidad es por equipo individual,
   * no por aforo grupal del espacio (ver LaboratoriosService.validarCapacidadPorModo).
   */
  @Column({ type: 'int', nullable: true })
  capacidad?: number | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  ubicacion?: string | null;

  @Column({
    type: 'enum',
    enum: EstadoLaboratorio,
    default: EstadoLaboratorio.ACTIVO,
  })
  estado!: EstadoLaboratorio;

  @Column({
    name: 'modo_reserva',
    type: 'enum',
    enum: ModoReservaLaboratorio,
    default: ModoReservaLaboratorio.ESTANDAR,
  })
  modoReserva!: ModoReservaLaboratorio;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion!: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fechaActualizacion!: Date;

  @DeleteDateColumn({ name: 'fecha_eliminacion' })
  fechaEliminacion!: Date | null;
}
