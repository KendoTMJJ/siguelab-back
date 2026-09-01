import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from 'src/usuarios/entities/usuario.entity';
import { ServicioTecnologico } from './servicio-tecnologico.entity';
import { CotizacionEquipo } from './cotizacion-equipo.entity';

/**
 * Cotización armada a mano por el laboratorista/admin (sin catálogo de
 * tarifas — decisión de negocio para no bloquear el desarrollo en diseñar
 * ese catálogo). El sistema solo suma los campos, no calcula ninguno desde
 * un precio de referencia.
 */
@Entity('cotizacion_servicio')
export class CotizacionServicio {
  @PrimaryGeneratedColumn({ name: 'id_cotizacion' })
  idCotizacion!: number;

  @Column({ name: 'id_servicio' })
  idServicio!: number;

  @OneToOne(() => ServicioTecnologico, (servicio) => servicio.cotizacion)
  @JoinColumn({ name: 'id_servicio' })
  servicio!: ServicioTecnologico;

  @Column({ name: 'id_cotizado_por', type: 'uuid' })
  idCotizadoPor!: string;

  /** Quién armó la cotización (laboratorista o admin) — trazabilidad. */
  @JoinColumn({ name: 'id_cotizado_por' })
  cotizadoPor?: Usuario;

  @Column({ name: 'descripcion_material', type: 'text', nullable: true })
  descripcionMaterial?: string | null;

  @Column({
    name: 'costo_material',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  costoMaterial!: string;

  @Column({
    name: 'costo_tiempo_uso',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  costoTiempoUso!: string;

  @Column({
    name: 'costo_energia',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  costoEnergia!: string;

  @Column({
    name: 'costo_mano_obra',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  costoManoObra!: string;

  @Column({
    name: 'costos_adicionales',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  costosAdicionales!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  margen!: string;

  /** Suma de todos los campos anteriores + margen — la calcula el service,
   * no se recibe del cliente (ver CotizacionesServiciosService.calcularTotal). */
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  total!: string;

  @OneToMany(() => CotizacionEquipo, (ce) => ce.cotizacion, { cascade: true })
  equipos!: CotizacionEquipo[];

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion!: Date;
}
