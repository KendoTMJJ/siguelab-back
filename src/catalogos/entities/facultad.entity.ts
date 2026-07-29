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
import { Division } from './division.entity';

export enum NivelFacultad {
  PREGRADO = 'pregrado',
  POSGRADO = 'posgrado',
}

@Entity('facultad')
export class Facultad {
  @PrimaryGeneratedColumn({ name: 'id_facultad' })
  idFacultad!: number;

  @Column({ name: 'id_division' })
  idDivision!: number;

  @ManyToOne(() => Division, (division) => division.facultades)
  @JoinColumn({ name: 'id_division' })
  division!: Division;

  @Column({ length: 150 })
  nombre!: string;

  /**
   * Agregado para el export de asistencias a Power BI (columna "Nivel" del
   * Excel) — no existía ningún concepto de pregrado/posgrado en el sistema.
   */
  @Column({
    type: 'enum',
    enum: NivelFacultad,
    default: NivelFacultad.PREGRADO,
  })
  nivel!: NivelFacultad;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion!: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fechaActualizacion!: Date;

  @DeleteDateColumn({ name: 'fecha_eliminacion' })
  fechaEliminacion!: Date | null;
}
