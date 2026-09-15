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
  /** Confirmación al propio solicitante de que su reserva se envió y quedó
   * registrada — se manda siempre, sin importar quién la crea (estudiante o
   * docente). Distinta de SOLICITUD_CREADA, que es el aviso AL docente de
   * que tiene algo para firmar (esa solo aplica cuando crea un estudiante). */
  SOLICITUD_ENVIADA = 'solicitud_enviada',
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
  /** Recién insertada, todavía no se intentó mandar el correo — la toma el
   * worker (ver NotificacionesService.enviarPendientes, disparado por cron). */
  PENDIENTE = 'pendiente',
  ENVIADA = 'enviada',
  LEIDA = 'leida',
  /** Se agotaron los reintentos (ver MAX_INTENTOS) sin lograr enviarla. */
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

  /** Asunto y cuerpo ya renderizados en el momento de crear la solicitud
   * (es trabajo síncrono, no necesita red) — el worker que manda el correo
   * corre después, en otro momento, y ya no tiene en memoria los datos de
   * la solicitud/servicio/evento para reconstruirlos. */
  @Column({ length: 150 })
  asunto!: string;

  @Column({ name: 'cuerpo_html', type: 'text' })
  cuerpoHtml!: string;

  @Column({ default: 0 })
  intentos!: number;

  @CreateDateColumn({ name: 'fecha_envio' })
  fechaEnvio!: Date;

  @Column({
    type: 'enum',
    enum: EstadoNotificacion,
    default: EstadoNotificacion.PENDIENTE,
  })
  estado!: EstadoNotificacion;
}
