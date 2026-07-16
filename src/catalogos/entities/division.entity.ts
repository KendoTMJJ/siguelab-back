import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Facultad } from './facultad.entity';

@Entity('division')
export class Division {
  @PrimaryGeneratedColumn({ name: 'id_division' })
  idDivision!: number;

  @Column({ length: 120 })
  nombre!: string;

  @OneToMany(() => Facultad, (facultad) => facultad.division)
  facultades!: Facultad[];

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion!: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fechaActualizacion!: Date;

  @DeleteDateColumn({ name: 'fecha_eliminacion' })
  fechaEliminacion!: Date | null;
}
