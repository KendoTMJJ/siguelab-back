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
import { Servicio } from 'src/servicios/entities/servicio.entity';

/**
 * disponible/reservado/en_uso se derivan solos del calendario de servicios y
 * eventos (no se setean a mano) — solo mantenimiento/fuera_servicio los marca
 * manualmente un laboratorista o admin, y mientras el equipo esté en alguno de
 * esos dos estados no se puede programar ningún servicio sobre él.
 */
export enum EstadoEquipo {
  DISPONIBLE = 'disponible',
  RESERVADO = 'reservado',
  EN_USO = 'en_uso',
  MANTENIMIENTO = 'mantenimiento',
  FUERA_SERVICIO = 'fuera_servicio',
}

/**
 * Cada unidad física es una fila propia (no un contador de "cantidad"): dos
 * impresoras del mismo modelo son dos registros distintos, porque cada una
 * necesita su propio calendario y estado independiente.
 */
@Entity('equipo')
export class Equipo {
  @PrimaryGeneratedColumn({ name: 'id_equipo' })
  idEquipo!: number;

  @Column({ name: 'id_laboratorio' })
  idLaboratorio!: number;

  @ManyToOne(() => Laboratorio)
  @JoinColumn({ name: 'id_laboratorio' })
  laboratorio!: Laboratorio;

  @Column({ length: 150 })
  nombre!: string;

  @Column({ length: 100 })
  tecnologia!: string;

  /** A qué servicio del catálogo pertenece (ej. 5 impresoras → "Impresión
   * 3D") — nullable porque no todos los equipos tienen por qué estar
   * clasificados bajo un servicio todavía. */
  @Column({ name: 'id_servicio', nullable: true })
  idServicio?: number | null;

  @ManyToOne(() => Servicio, { nullable: true })
  @JoinColumn({ name: 'id_servicio' })
  servicio?: Servicio | null;

  /**
   * Ficha técnica como archivo adjunto (PDF/imagen del datasheet o manual del
   * fabricante), no texto libre. `fichaTecnicaRuta` es el nombre generado en
   * disco (uuid + extensión, ver EquiposLaboratorioService.subirFichaTecnica);
   * `fichaTecnicaNombreOriginal` es el que se muestra al descargar.
   */
  @Column({
    name: 'ficha_tecnica_ruta',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  fichaTecnicaRuta?: string | null;

  @Column({
    name: 'ficha_tecnica_nombre_original',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  fichaTecnicaNombreOriginal?: string | null;

  @Column({
    name: 'ficha_tecnica_mime_type',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  fichaTecnicaMimeType?: string | null;

  @Column({
    type: 'enum',
    enum: EstadoEquipo,
    default: EstadoEquipo.DISPONIBLE,
  })
  estado!: EstadoEquipo;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion!: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fechaActualizacion!: Date;

  @DeleteDateColumn({ name: 'fecha_eliminacion' })
  fechaEliminacion!: Date | null;
}
