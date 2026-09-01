import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Equipo } from 'src/equipos-laboratorio/entities/equipo.entity';
import { EventoLaboratorio } from './evento-laboratorio.entity';

/** Solo existen filas aquí cuando EventoLaboratorio.modalidad = 'parcial' — en
 * modalidad 'total' el bloqueo es sobre todo el laboratorio, sin necesidad de
 * listar equipos uno por uno. */
@Entity('evento_equipo')
@Index(['idEvento', 'idEquipo'], { unique: true })
export class EventoEquipo {
  @PrimaryGeneratedColumn({ name: 'id_evento_equipo' })
  idEventoEquipo!: number;

  @Column({ name: 'id_evento' })
  idEvento!: number;

  @ManyToOne(() => EventoLaboratorio, (e) => e.equipos)
  @JoinColumn({ name: 'id_evento' })
  evento!: EventoLaboratorio;

  @Column({ name: 'id_equipo' })
  idEquipo!: number;

  @ManyToOne(() => Equipo)
  @JoinColumn({ name: 'id_equipo' })
  equipo!: Equipo;
}
