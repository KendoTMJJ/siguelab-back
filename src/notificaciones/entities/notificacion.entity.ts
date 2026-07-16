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

export enum TipoEventoNotificacion {
  SOLICITUD_CREADA = 'solicitud_creada',
  PENDIENTE_FIRMA = 'pendiente_firma',
  FIRMA_APROBADA = 'firma_aprobada',
  SOLICITUD_APROBADA = 'solicitud_aprobada',
  SOLICITUD_RECHAZADA = 'solicitud_rechazada',
  SOLICITUD_CANCELADA = 'solicitud_cancelada',
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

  @Column({ name: 'id_solicitud' })
  idSolicitud!: number;

  @ManyToOne(() => SolicitudReserva)
  @JoinColumn({ name: 'id_solicitud' })
  solicitud!: SolicitudReserva;

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
