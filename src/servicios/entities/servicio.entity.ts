import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Laboratorio } from 'src/laboratorios/entities/laboratorio.entity';

/**
 * Catálogo de servicios que ofrece un laboratorio (ej. "Impresión 3D",
 * "Corte láser") — reemplaza al enum fijo TipoServicio que antes vivía en
 * ServicioTecnologico, para que cada laboratorio de fabricación digital
 * pueda tener su propio catálogo en vez de una lista genérica igual para
 * todos. No tiene relación directa con Equipo: la relación va al revés
 * (Equipo.idServicio, nullable) — así varios equipos del mismo tipo (ej. 5
 * impresoras) comparten un solo Servicio "Impresión 3D", y un servicio sin
 * ningún equipo asociado (ej. "Diseño") es válido: simplemente no tiene
 * máquina dedicada.
 */
export enum EstadoServicio {
  ACTIVO = 'activo',
  INACTIVO = 'inactivo',
}

@Entity('servicio')
export class Servicio {
  @PrimaryGeneratedColumn({ name: 'id_servicio' })
  idServicio!: number;

  @Column({ name: 'id_laboratorio' })
  idLaboratorio!: number;

  @ManyToOne(() => Laboratorio)
  @JoinColumn({ name: 'id_laboratorio' })
  laboratorio!: Laboratorio;

  @Column({ length: 100 })
  nombre!: string;

  @Column({
    type: 'enum',
    enum: EstadoServicio,
    default: EstadoServicio.ACTIVO,
  })
  estado!: EstadoServicio;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion!: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fechaActualizacion!: Date;

  @DeleteDateColumn({ name: 'fecha_eliminacion' })
  fechaEliminacion!: Date | null;
}
