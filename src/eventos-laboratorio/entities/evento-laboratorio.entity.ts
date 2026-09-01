import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Usuario } from 'src/usuarios/entities/usuario.entity';
import { Laboratorio } from 'src/laboratorios/entities/laboratorio.entity';
import { EventoEquipo } from './evento-equipo.entity';

export enum ModalidadEvento {
  PARCIAL = 'parcial',
  TOTAL = 'total',
}

export enum PrioridadEvento {
  NORMAL = 'normal',
  ALTA = 'alta',
}

export enum EstadoEvento {
  SOLICITADO = 'solicitado',
  APROBADO = 'aprobado',
  RECHAZADO = 'rechazado',
  CANCELADO = 'cancelado',
}

/**
 * A diferencia de ServicioTecnologico (el laboratorio ejecuta y entrega), aquí
 * los asistentes usan el espacio/equipos ellos mismos — por eso el flujo es
 * simple (se pide, se aprueba o rechaza) y no tiene cotización ni etapas de
 * ejecución/entrega. Modalidad total bloquea todo el laboratorio (no necesita
 * filas en EventoEquipo); parcial bloquea solo los equipos seleccionados.
 */
@Entity('evento_laboratorio')
export class EventoLaboratorio {
  @PrimaryGeneratedColumn({ name: 'id_evento' })
  idEvento!: number;

  @Column({ name: 'id_laboratorio' })
  idLaboratorio!: number;

  @ManyToOne(() => Laboratorio)
  @JoinColumn({ name: 'id_laboratorio' })
  laboratorio!: Laboratorio;

  @Column({ name: 'id_solicitante', type: 'uuid' })
  idSolicitante!: string;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'id_solicitante' })
  solicitante!: Usuario;

  /** Quién está a cargo durante el evento — puede no ser un usuario del
   * sistema (ej. un ponente externo), por eso es texto libre. */
  @Column({ length: 150 })
  responsable!: string;

  @Column({ name: 'dependencia_solicitante', length: 150 })
  dependenciaSolicitante!: string;

  @Column({ type: 'date' })
  fecha!: string;

  @Column({ name: 'hora_inicio', type: 'time' })
  horaInicio!: string;

  @Column({ name: 'hora_fin', type: 'time' })
  horaFin!: string;

  @Column({ name: 'num_asistentes', type: 'int' })
  numAsistentes!: number;

  @Column({
    type: 'enum',
    enum: PrioridadEvento,
    default: PrioridadEvento.NORMAL,
  })
  prioridad!: PrioridadEvento;

  @Column({ type: 'text', nullable: true })
  observaciones?: string | null;

  @Column({ type: 'enum', enum: ModalidadEvento })
  modalidad!: ModalidadEvento;

  @Column({
    type: 'enum',
    enum: EstadoEvento,
    default: EstadoEvento.SOLICITADO,
  })
  estado!: EstadoEvento;

  @Column({ name: 'motivo_rechazo', type: 'text', nullable: true })
  motivoRechazo?: string | null;

  @Column({ name: 'motivo_cancelacion', type: 'text', nullable: true })
  motivoCancelacion?: string | null;

  /** Quién aprobó y cuándo — trazabilidad, análoga a idFirmante/fechaHora
   * en Firma para el flujo estándar. */
  @Column({ name: 'id_aprobado_por', type: 'uuid', nullable: true })
  idAprobadoPor?: string | null;

  @Column({ name: 'fecha_aprobacion', type: 'timestamp', nullable: true })
  fechaAprobacion?: Date | null;

  /** El solicitante puede ocultarlo de "Mis solicitudes" una vez rechazado o
   * cancelado — no lo borra (ver SolicitudReserva.archivada). */
  @Column({ default: false })
  archivada!: boolean;

  @OneToMany(() => EventoEquipo, (ee) => ee.evento, { cascade: true })
  equipos!: EventoEquipo[];

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion!: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fechaActualizacion!: Date;
}
