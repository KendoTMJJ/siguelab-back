import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Usuario } from 'src/usuarios/entities/usuario.entity';
import { Laboratorio } from 'src/laboratorios/entities/laboratorio.entity';
import { Equipo } from 'src/equipos-laboratorio/entities/equipo.entity';
import { Servicio } from 'src/servicios/entities/servicio.entity';
import { CotizacionServicio } from './cotizacion-servicio.entity';

/**
 * Solicitado → En revisión → Cotizado → Aprobado → Programado → En proceso →
 * Finalizado → Entregado (= cierre, ver decisión de negocio). Rechazado y
 * Cancelado son finales y pueden alcanzarse desde varios puntos del flujo.
 */
export enum EstadoServicioTecnologico {
  SOLICITADO = 'solicitado',
  EN_REVISION = 'en_revision',
  COTIZADO = 'cotizado',
  APROBADO = 'aprobado',
  PROGRAMADO = 'programado',
  EN_PROCESO = 'en_proceso',
  FINALIZADO = 'finalizado',
  ENTREGADO = 'entregado',
  RECHAZADO = 'rechazado',
  CANCELADO = 'cancelado',
}

const ESTADOS_CON_ARCHIVO_EDITABLE = [
  EstadoServicioTecnologico.SOLICITADO,
  EstadoServicioTecnologico.EN_REVISION,
];

/** El archivo adjunto solo se puede subir/reemplazar/borrar mientras el
 * servicio está en Solicitado o En revisión — una vez cotizado, queda fijo. */
export function archivoEsEditableEnEstado(
  estado: EstadoServicioTecnologico,
): boolean {
  return ESTADOS_CON_ARCHIVO_EDITABLE.includes(estado);
}

/**
 * A diferencia de SolicitudReserva (reserva de espacio, el usuario opera él
 * mismo), aquí el laboratorista ejecuta el trabajo y entrega el resultado —
 * por eso no hay firmas ni aforo por personas, sino cotización + equipos
 * asignados por el técnico (ver CotizacionServicio/CotizacionEquipo).
 */
@Entity('servicio_tecnologico')
export class ServicioTecnologico {
  @PrimaryGeneratedColumn({ name: 'id_servicio' })
  idServicio!: number;

  @Column({ name: 'id_solicitante', type: 'uuid' })
  idSolicitante!: string;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'id_solicitante' })
  solicitante!: Usuario;

  /** Se fija al crear (no opcional, a diferencia de idEquipoSugerido) — sin
   * esto no hay forma de saber de qué laboratorio es la solicitud cuando el
   * tipo de servicio no requiere sugerir un equipo (ej. "Diseño"). */
  @Column({ name: 'id_laboratorio' })
  idLaboratorio!: number;

  @ManyToOne(() => Laboratorio)
  @JoinColumn({ name: 'id_laboratorio' })
  laboratorio!: Laboratorio;

  /** A qué servicio del catálogo del laboratorio corresponde (ej. "Impresión
   * 3D") — reemplaza al enum fijo TipoServicio que había antes. Nombrado
   * distinto a `idServicio` (que es el PK de esta misma entidad) para no
   * chocar. */
  @Column({ name: 'id_servicio_solicitado' })
  idServicioSolicitado!: number;

  @ManyToOne(() => Servicio)
  @JoinColumn({ name: 'id_servicio_solicitado' })
  servicioSolicitado!: Servicio;

  @Column({ type: 'text' })
  descripcion!: string;

  /** Sugerencia del solicitante, no vinculante — el técnico decide el/los
   * equipo(s) reales al cotizar (ver CotizacionEquipo). */
  @Column({ name: 'id_equipo_sugerido', nullable: true })
  idEquipoSugerido?: number | null;

  @ManyToOne(() => Equipo, { nullable: true })
  @JoinColumn({ name: 'id_equipo_sugerido' })
  equipoSugerido?: Equipo | null;

  @Column({
    name: 'archivo_ruta',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  archivoRuta?: string | null;

  @Column({
    name: 'archivo_nombre_original',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  archivoNombreOriginal?: string | null;

  @Column({
    type: 'enum',
    enum: EstadoServicioTecnologico,
    default: EstadoServicioTecnologico.SOLICITADO,
  })
  estado!: EstadoServicioTecnologico;

  @Column({ name: 'motivo_rechazo', type: 'text', nullable: true })
  motivoRechazo?: string | null;

  @Column({ name: 'motivo_cancelacion', type: 'text', nullable: true })
  motivoCancelacion?: string | null;

  /** Quién marcó "entregado" (cierre del servicio) y cuándo — trazabilidad,
   * análoga a idFirmante/fechaHora en Firma para el flujo estándar. */
  @Column({ name: 'id_entregado_por', type: 'uuid', nullable: true })
  idEntregadoPor?: string | null;

  @Column({ name: 'fecha_entrega', type: 'timestamp', nullable: true })
  fechaEntrega?: Date | null;

  /** El solicitante puede ocultarlo de "Mis solicitudes" una vez rechazado o
   * cancelado — no lo borra, solo lo saca de esa vista (ver SolicitudReserva.archivada). */
  @Column({ default: false })
  archivada!: boolean;

  /** "Vaciar archivados" — soft delete separado de `archivada` (ver
   * SolicitudReserva.eliminada, mismo criterio). */
  @Column({ default: false })
  eliminada!: boolean;

  @OneToOne(() => CotizacionServicio, (cotizacion) => cotizacion.servicio)
  cotizacion?: CotizacionServicio;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion!: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fechaActualizacion!: Date;
}
