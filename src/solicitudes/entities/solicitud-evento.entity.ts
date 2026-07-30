import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from 'src/usuarios/entities/usuario.entity';
import { SolicitudReserva } from './solicitud-reserva.entity';

export enum TipoEventoSolicitud {
  CREADA = 'creada',
  FIRMA_DOCENTE_APROBADA = 'firma_docente_aprobada',
  FIRMA_DOCENTE_RECHAZADA = 'firma_docente_rechazada',
  FIRMA_LABORATORISTA_APROBADA = 'firma_laboratorista_aprobada',
  FIRMA_LABORATORISTA_RECHAZADA = 'firma_laboratorista_rechazada',
  CANCELADA = 'cancelada',
}

/**
 * Bitácora de trazabilidad de una solicitud — append-only, sin UPDATE ni
 * DELETE, sin controlador propio (la gestiona SolicitudesService en cada
 * punto donde ya cambiaba el estado). Cada fila es un hecho ocurrido, nunca
 * se corrige ni se borra; si algo se resolvió mal, el siguiente evento real
 * (otra firma, otro rechazo) es lo que corrige la historia.
 *
 * A propósito NO distingue el rechazo automático del sistema (por falta de
 * disponibilidad al firmar el laboratorista) de un rechazo humano — ambos
 * caen en FIRMA_LABORATORISTA_RECHAZADA con el mismo actor (el laboratorista
 * que disparó el intento) y el detalle explica qué pasó.
 */
@Entity('solicitud_evento')
export class SolicitudEvento {
  @PrimaryGeneratedColumn({ name: 'id_evento' })
  idEvento!: number;

  @Column({ name: 'id_solicitud' })
  idSolicitud!: number;

  @ManyToOne(() => SolicitudReserva, (solicitud) => solicitud.eventos)
  @JoinColumn({ name: 'id_solicitud' })
  solicitud!: SolicitudReserva;

  @Column({ type: 'enum', enum: TipoEventoSolicitud })
  tipo!: TipoEventoSolicitud;

  /** Quién generó el evento — nullable solo por consistencia de esquema;
   * en la práctica siempre hay un actor autenticado detrás de cada evento. */
  @Column({ name: 'id_actor', type: 'uuid', nullable: true })
  idActor?: string | null;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'id_actor' })
  actor?: Usuario | null;

  /** Observación/motivo asociado (mismo texto que ya se guardaba en
   * firma.observacion o solicitud.motivoCancelacion), replicado aquí para
   * que el evento sea autocontenido en la línea de tiempo. */
  @Column({ type: 'text', nullable: true })
  detalle?: string | null;

  @CreateDateColumn({ name: 'fecha' })
  fecha!: Date;
}
