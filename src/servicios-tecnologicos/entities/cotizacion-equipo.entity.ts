import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Equipo } from 'src/equipos-laboratorio/entities/equipo.entity';
import { CotizacionServicio } from './cotizacion-servicio.entity';

/**
 * Uno o varios equipos reales asignados por el técnico al cotizar (no el
 * equipoSugerido del solicitante, que es solo referencia) — un prototipado
 * puede usar más de una máquina. horaInicioReal/horaFinReal quedan nullable
 * porque se llenan recién al ejecutar, análogo a RegistroUso pero por equipo
 * dentro de un mismo servicio.
 */
@Entity('cotizacion_equipo')
@Index(['idCotizacion', 'idEquipo'], { unique: true })
export class CotizacionEquipo {
  @PrimaryGeneratedColumn({ name: 'id_cotizacion_equipo' })
  idCotizacionEquipo!: number;

  @Column({ name: 'id_cotizacion' })
  idCotizacion!: number;

  @ManyToOne(() => CotizacionServicio, (c) => c.equipos)
  @JoinColumn({ name: 'id_cotizacion' })
  cotizacion!: CotizacionServicio;

  @Column({ name: 'id_equipo' })
  idEquipo!: number;

  @ManyToOne(() => Equipo)
  @JoinColumn({ name: 'id_equipo' })
  equipo!: Equipo;

  @Column({ name: 'fecha_programada', type: 'date', nullable: true })
  fechaProgramada?: string | null;

  @Column({ name: 'hora_inicio_programada', type: 'time', nullable: true })
  horaInicioProgramada?: string | null;

  @Column({ name: 'hora_fin_programada', type: 'time', nullable: true })
  horaFinProgramada?: string | null;

  @Column({ name: 'hora_inicio_real', type: 'timestamp', nullable: true })
  horaInicioReal?: Date | null;

  @Column({ name: 'id_iniciado_por', type: 'uuid', nullable: true })
  idIniciadoPor?: string | null;

  @Column({ name: 'hora_fin_real', type: 'timestamp', nullable: true })
  horaFinReal?: Date | null;

  @Column({ name: 'id_finalizado_por', type: 'uuid', nullable: true })
  idFinalizadoPor?: string | null;

  @Column({ name: 'id_programado_por', type: 'uuid', nullable: true })
  idProgramadoPor?: string | null;
}
