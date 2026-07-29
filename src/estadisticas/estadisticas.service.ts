import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import {
  EstadoLaboratorio,
  Laboratorio,
} from 'src/laboratorios/entities/laboratorio.entity';
import {
  EstadoSolicitud,
  SolicitudReserva,
} from 'src/solicitudes/entities/solicitud-reserva.entity';
import { RegistroUso } from 'src/bitacora/entities/registro-uso.entity';

export interface FiltrosEstadisticas {
  idPeriodo?: number;
}

export interface ConteoNombre {
  nombre: string;
  total: number;
}

export interface EstadisticasResumen {
  totalSolicitudes: number;
  /** aprobadas / (aprobadas + rechazadas) * 100 — 0 si no hay ninguna resuelta. */
  tasaAprobacion: number;
  laboratoriosActivos: number;
  horasUsoTotales: number;
  solicitudesPorEstado: {
    aprobadas: number;
    enProceso: number;
    rechazadas: number;
    canceladas: number;
  };
  topLaboratorios: ConteoNombre[];
  solicitudesPorTipo: ConteoNombre[];
  solicitudesPorFacultad: ConteoNombre[];
  usoPorLaboratorio: ConteoNombre[];
}

const TOP_LABORATORIOS = 8;
const TOP_FACULTADES = 8;
const TOP_TIPOS = 3;
const TOP_USO_LABORATORIO = 8;

@Injectable()
export class EstadisticasService {
  private readonly solicitudRepository: Repository<SolicitudReserva>;
  private readonly laboratorioRepository: Repository<Laboratorio>;
  private readonly registroUsoRepository: Repository<RegistroUso>;

  constructor(private readonly dataSource: DataSource) {
    this.solicitudRepository = this.dataSource.getRepository(SolicitudReserva);
    this.laboratorioRepository = this.dataSource.getRepository(Laboratorio);
    this.registroUsoRepository = this.dataSource.getRepository(RegistroUso);
  }

  async obtener(filtros: FiltrosEstadisticas): Promise<EstadisticasResumen> {
    const [
      solicitudesPorEstadoCrudo,
      topLaboratorios,
      solicitudesPorTipoCrudo,
      solicitudesPorFacultad,
      usoPorLaboratorio,
      laboratoriosActivos,
    ] = await Promise.all([
      this.contarSolicitudesPorEstado(filtros),
      this.contarSolicitudesAgrupadas(filtros, 'laboratorio', TOP_LABORATORIOS),
      // Sin límite: colapsarEnOtros() necesita el total real de TODOS los tipos
      // fuera del top-3 para sumarlos en "Otros", no solo un recorte parcial.
      this.contarSolicitudesAgrupadas(filtros, 'tipoReserva'),
      this.contarSolicitudesAgrupadas(filtros, 'facultad', TOP_FACULTADES),
      this.contarHorasUsoPorLaboratorio(filtros),
      this.laboratorioRepository.count({
        where: { estado: EstadoLaboratorio.ACTIVO },
      }),
    ]);

    const solicitudesPorEstado = {
      aprobadas: solicitudesPorEstadoCrudo[EstadoSolicitud.APROBADA] ?? 0,
      enProceso:
        (solicitudesPorEstadoCrudo[EstadoSolicitud.PENDIENTE_DOCENTE] ?? 0) +
        (solicitudesPorEstadoCrudo[EstadoSolicitud.PENDIENTE_LABORATORISTA] ??
          0),
      rechazadas: solicitudesPorEstadoCrudo[EstadoSolicitud.RECHAZADA] ?? 0,
      canceladas: solicitudesPorEstadoCrudo[EstadoSolicitud.CANCELADA] ?? 0,
    };
    const totalSolicitudes =
      solicitudesPorEstado.aprobadas +
      solicitudesPorEstado.enProceso +
      solicitudesPorEstado.rechazadas +
      solicitudesPorEstado.canceladas;
    const totalResueltas =
      solicitudesPorEstado.aprobadas + solicitudesPorEstado.rechazadas;
    const tasaAprobacion =
      totalResueltas > 0
        ? (solicitudesPorEstado.aprobadas / totalResueltas) * 100
        : 0;

    return {
      totalSolicitudes,
      tasaAprobacion: Math.round(tasaAprobacion * 10) / 10,
      laboratoriosActivos,
      horasUsoTotales: usoPorLaboratorio.reduce(
        (total, fila) => total + fila.total,
        0,
      ),
      solicitudesPorEstado,
      topLaboratorios,
      solicitudesPorTipo: this.colapsarEnOtros(
        solicitudesPorTipoCrudo,
        TOP_TIPOS,
      ),
      solicitudesPorFacultad,
      usoPorLaboratorio: usoPorLaboratorio
        .slice(0, TOP_USO_LABORATORIO)
        .map((fila) => ({
          nombre: fila.nombre,
          total: Math.round(fila.total * 10) / 10,
        })),
    };
  }

  private async contarSolicitudesPorEstado(
    filtros: FiltrosEstadisticas,
  ): Promise<Record<string, number>> {
    const query = this.solicitudRepository
      .createQueryBuilder('solicitud')
      .select('solicitud.estado', 'estado')
      .addSelect('COUNT(*)', 'total')
      .groupBy('solicitud.estado');
    if (filtros.idPeriodo) {
      query.andWhere('solicitud.id_periodo = :idPeriodo', {
        idPeriodo: filtros.idPeriodo,
      });
    }

    const filas = await query.getRawMany<{
      estado: EstadoSolicitud;
      total: string;
    }>();
    return Object.fromEntries(
      filas.map((fila) => [fila.estado, Number(fila.total)]),
    );
  }

  private async contarSolicitudesAgrupadas(
    filtros: FiltrosEstadisticas,
    relacion: 'laboratorio' | 'tipoReserva' | 'facultad',
    limite?: number,
  ): Promise<ConteoNombre[]> {
    const query = this.solicitudRepository
      .createQueryBuilder('solicitud')
      .innerJoin(`solicitud.${relacion}`, 'entidad')
      .select('entidad.nombre', 'nombre')
      .addSelect('COUNT(*)', 'total')
      .groupBy('entidad.nombre')
      .orderBy('total', 'DESC');
    if (limite) {
      query.limit(limite);
    }
    if (filtros.idPeriodo) {
      query.andWhere('solicitud.id_periodo = :idPeriodo', {
        idPeriodo: filtros.idPeriodo,
      });
    }

    const filas = await query.getRawMany<{ nombre: string; total: string }>();
    return filas.map((fila) => ({
      nombre: fila.nombre,
      total: Number(fila.total),
    }));
  }

  private async contarHorasUsoPorLaboratorio(
    filtros: FiltrosEstadisticas,
  ): Promise<ConteoNombre[]> {
    const query = this.registroUsoRepository
      .createQueryBuilder('registro')
      .innerJoin('registro.laboratorio', 'laboratorio')
      .select('laboratorio.nombre', 'nombre')
      .addSelect(
        'SUM(TIMESTAMPDIFF(MINUTE, registro.hora_inicio_real, registro.hora_fin_real)) / 60',
        'total',
      )
      .groupBy('laboratorio.nombre')
      .orderBy('total', 'DESC');

    if (filtros.idPeriodo) {
      query
        .innerJoin(
          'solicitud_reserva',
          'solicitud',
          'solicitud.id_solicitud = registro.id_solicitud',
        )
        .andWhere('solicitud.id_periodo = :idPeriodo', {
          idPeriodo: filtros.idPeriodo,
        });
    }

    const filas = await query.getRawMany<{
      nombre: string;
      total: string | null;
    }>();
    return filas.map((fila) => ({
      nombre: fila.nombre,
      total: Number(fila.total ?? 0),
    }));
  }

  private colapsarEnOtros(filas: ConteoNombre[], top: number): ConteoNombre[] {
    if (filas.length <= top) {
      return filas;
    }
    const principales = filas.slice(0, top);
    const otros = filas
      .slice(top)
      .reduce((total, fila) => total + fila.total, 0);
    return otros > 0
      ? [...principales, { nombre: 'Otros', total: otros }]
      : principales;
  }
}
