import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from 'src/usuarios/entities/usuario.entity';
import { SolicitudReserva } from 'src/solicitudes/entities/solicitud-reserva.entity';
import { ServicioTecnologico } from 'src/servicios-tecnologicos/entities/servicio-tecnologico.entity';
import { EventoLaboratorio } from 'src/eventos-laboratorio/entities/evento-laboratorio.entity';

export enum TipoEventoNotificacion {
  SOLICITUD_CREADA = 'solicitud_creada',
  PENDIENTE_FIRMA = 'pendiente_firma',
  FIRMA_APROBADA = 'firma_aprobada',
  SOLICITUD_APROBADA = 'solicitud_aprobada',
  SOLICITUD_RECHAZADA = 'solicitud_rechazada',
  SOLICITUD_CANCELADA = 'solicitud_cancelada',
  SERVICIO_SOLICITADO = 'servicio_solicitado',
  SERVICIO_COTIZADO = 'servicio_cotizado',
  SERVICIO_APROBADO = 'servicio_aprobado',
  SERVICIO_RECHAZADO = 'servicio_rechazado',
  SERVICIO_PROGRAMADO = 'servicio_programado',
  SERVICIO_ENTREGADO = 'servicio_entregado',
  SERVICIO_CANCELADO = 'servicio_cancelado',
  EVENTO_SOLICITADO = 'evento_solicitado',
  EVENTO_APROBADO = 'evento_aprobado',
  EVENTO_RECHAZADO = 'evento_rechazado',
  EVENTO_CANCELADO = 'evento_cancelado',
}

export enum EstadoNotificacion {
  ENVIADA = 'enviada',
  LEIDA = 'leida',
  FALLIDA = 'fallida',
}

@Entity('notificacion')
export class Notificacion {
  @PrimaryGeneratedColumn({ name: 'id_notificacion' })
  idNotificacion!: number;

  /** Exactamente uno de los tres está lleno, según de qué módulo vino el
   * evento — nullable porque un mismo registro de notificación nunca
   * pertenece a más de un origen. */
  @Column({ name: 'id_solicitud', nullable: true })
  idSolicitud?: number | null;

  @ManyToOne(() => SolicitudReserva, { nullable: true })
  @JoinColumn({ name: 'id_solicitud' })
  solicitud?: SolicitudReserva | null;

  @Column({ name: 'id_servicio', nullable: true })
  idServicio?: number | null;

  @ManyToOne(() => ServicioTecnologico, { nullable: true })
  @JoinColumn({ name: 'id_servicio' })
  servicio?: ServicioTecnologico | null;

  @Column({ name: 'id_evento', nullable: true })
  idEvento?: number | null;

  @ManyToOne(() => EventoLaboratorio, { nullable: true })
  @JoinColumn({ name: 'id_evento' })
  evento?: EventoLaboratorio | null;

  @Column({ name: 'id_destinatario', type: 'uuid' })
  idDestinatario!: string;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'id_destinatario' })
  destinatario!: Usuario;

  @Column({ name: 'tipo_evento', length: 40 })
  tipoEvento!: string;

  @CreateDateColumn({ name: 'fecha_envio' })
  fechaEnvio!: Date;

  @Column({
    type: 'enum',
    enum: EstadoNotificacion,
    default: EstadoNotificacion.ENVIADA,
  })
  estado!: EstadoNotificacion;
}
