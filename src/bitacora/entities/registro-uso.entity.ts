import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from 'src/usuarios/entities/usuario.entity';
import { Laboratorio } from 'src/laboratorios/entities/laboratorio.entity';
import { TipoReserva } from 'src/catalogos/entities/tipo-reserva.entity';
import { SolicitudReserva } from 'src/solicitudes/entities/solicitud-reserva.entity';

/**
 * Registro del uso REAL de un laboratorio. Es historia: no tiene soft delete
 * ni DELETE por API. id_solicitud es nullable a propósito: hay usos válidos
 * sin reserva (eventualidades, históricos migrados).
 */
@Entity('registro_uso')
export class RegistroUso {
  @PrimaryGeneratedColumn({ name: 'id_registro' })
  idRegistro!: number;

  @Column({ name: 'id_solicitud', nullable: true })
  idSolicitud?: number | null;

  @ManyToOne(() => SolicitudReserva, { nullable: true })
  @JoinColumn({ name: 'id_solicitud' })
  solicitud?: SolicitudReserva | null;

  @Column({ name: 'id_laboratorio' })
  idLaboratorio!: number;

  @ManyToOne(() => Laboratorio)
  @JoinColumn({ name: 'id_laboratorio' })
  laboratorio!: Laboratorio;

  /** Quien registra (trazabilidad), no una restricción de adscripción. */
  @Column({ name: 'id_laboratorista', type: 'uuid' })
  idLaboratorista!: string;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'id_laboratorista' })
  laboratorista!: Usuario;

  @Column({ name: 'id_tipo' })
  idTipo!: number;

  @ManyToOne(() => TipoReserva)
  @JoinColumn({ name: 'id_tipo' })
  tipoReserva!: TipoReserva;

  @Column({ type: 'date' })
  fecha!: string;

  @Column({ name: 'hora_inicio_real', type: 'time' })
  horaInicioReal!: string;

  @Column({ name: 'hora_fin_real', type: 'time' })
  horaFinReal!: string;

  @Column({ name: 'num_asistentes', type: 'int', default: 0 })
  numAsistentes!: number;

  @Column({ type: 'varchar', length: 60, nullable: true })
  novedad?: string | null;

  @Column({ type: 'text', nullable: true })
  observaciones?: string | null;
}
