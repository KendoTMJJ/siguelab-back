import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from 'src/usuarios/entities/usuario.entity';
import { SolicitudReserva } from './solicitud-reserva.entity';

export enum RolFirmante {
  DOCENTE = 'docente',
  LABORATORISTA = 'laboratorista',
}

export enum ResultadoFirma {
  PENDIENTE = 'pendiente',
  APROBADA = 'aprobada',
  RECHAZADA = 'rechazada',
}

/**
 * Sin controlador propio: la gestiona por completo el service de solicitudes.
 * id_firmante nullable a propósito (se llena solo al resolverse la firma;
 * en la bandeja compartida de laboratorista no se sabe de antemano quién).
 */
@Entity('firma')
@Index(['idSolicitud', 'orden'], { unique: true })
export class Firma {
  @PrimaryGeneratedColumn({ name: 'id_firma' })
  idFirma!: number;

  @Column({ name: 'id_solicitud' })
  idSolicitud!: number;

  @ManyToOne(() => SolicitudReserva, (solicitud) => solicitud.firmas)
  @JoinColumn({ name: 'id_solicitud' })
  solicitud!: SolicitudReserva;

  @Column({ name: 'id_firmante', type: 'uuid', nullable: true })
  idFirmante?: string | null;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'id_firmante' })
  firmante?: Usuario | null;

  @Column({ type: 'int' })
  orden!: number;

  @Column({ name: 'rol_firmante', type: 'enum', enum: RolFirmante })
  rolFirmante!: RolFirmante;

  @Column({
    type: 'enum',
    enum: ResultadoFirma,
    default: ResultadoFirma.PENDIENTE,
  })
  resultado!: ResultadoFirma;

  @Column({ name: 'motivo_rechazo', type: 'text', nullable: true })
  motivoRechazo?: string | null;

  @Column({ name: 'fecha_hora', type: 'timestamp', nullable: true })
  fechaHora?: Date | null;
}
