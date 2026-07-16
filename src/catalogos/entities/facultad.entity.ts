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

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion!: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fechaActualizacion!: Date;

  @DeleteDateColumn({ name: 'fecha_eliminacion' })
  fechaEliminacion!: Date | null;
}
