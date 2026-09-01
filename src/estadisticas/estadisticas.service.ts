import { Injectable } from '@nestjs/common';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import type { AuthenticatedUser } from 'src/auth/decorators/current-user.decorator';
import {
  EstadoLaboratorio,
  Laboratorio,
} from 'src/laboratorios/entities/laboratorio.entity';
import {
  EstadoSolicitud,
  SolicitudReserva,
} from 'src/solicitudes/entities/solicitud-reserva.entity';
import { RegistroUso } from 'src/bitacora/entities/registro-uso.entity';
import { NivelFacultad } from 'src/catalogos/entities/facultad.entity';
import { USO_LABORATORIO_MAP } from 'src/reportes/constantes/asistencias-excel.constants';

export interface FiltrosEstadisticas {
  idPeriodo?: number;
  idDivision?: number;
  idFacultad?: number;
  idLaboratorio?: number;
  nivel?: NivelFacultad;
}

export interface ConteoNombre {
  nombre: string;
  total: number;
}

export interface UsoPorCategoriaYFacultad {
  categoria: string;
  facultad: string;
  total: number;
}

export interface EstadisticasResumen {
  totalSolicitudes: number;
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
  solicitudesPorDivision: ConteoNombre[];
  solicitudesPorFacultad: ConteoNombre[];
  usoPorLaboratorio: ConteoNombre[];
  usoPorDivision: ConteoNombre[];
  usoPorFacultad: ConteoNombre[];
  usoPorNivel: ConteoNombre[];
  usoPorCategoriaYFacultad: UsoPorCategoriaYFacultad[];
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

  private aplicarScopeUsuario(
    query: SelectQueryBuilder<SolicitudReserva>,
    usuario: AuthenticatedUser,
  ): void {
    if (usuario.rol === 'docente') {
      query.andWhere('solicitud.id_docente_encargado = :idUsuario', {
        idUsuario: usuario.id,
      });
    } else if (usuario.rol === 'laboratorista') {
      query.andWhere(
        'EXISTS (SELECT 1 FROM firma f WHERE f.id_solicitud = solicitud.id_solicitud AND f.id_firmante = :idUsuario)',
        { idUsuario: usuario.id },
      );
    }
  }

  /**
   * `aliasFacultad`: el join a `facultad` no siempre queda bajo el alias
   * `facultad` — `contarSolicitudesAgrupadas` con relacion='facultad' ya la
   * join-ea bajo el alias `entidad` (es la propia entidad agrupada) y evita
   * un join duplicado, así que el WHERE de idDivision tiene que apuntar a
   * ESE alias o MySQL tira "Unknown column" (bug real, visto en logs).
   */
  private aplicarFiltrosSolicitud(
    query: SelectQueryBuilder<SolicitudReserva>,
    filtros: FiltrosEstadisticas,
    aliasFacultad = 'facultad',
  ): void {
    if (filtros.idPeriodo) {
      query.andWhere('solicitud.id_periodo = :idPeriodo', {
        idPeriodo: filtros.idPeriodo,
      });
    }
    if (filtros.idLaboratorio) {
      query.andWhere('solicitud.id_laboratorio = :idLaboratorio', {
        idLaboratorio: filtros.idLaboratorio,
      });
    }
    if (filtros.idFacultad) {
      query.andWhere('solicitud.id_facultad = :idFacultad', {
        idFacultad: filtros.idFacultad,
      });
    }
    if (filtros.idDivision) {
      query.andWhere(`${aliasFacultad}.id_division = :idDivision`, {
        idDivision: filtros.idDivision,
      });
    }
    if (filtros.nivel) {
      query.andWhere(`${aliasFacultad}.nivel = :nivel`, {
        nivel: filtros.nivel,
      });
    }
  }

  async obtener(
    filtros: FiltrosEstadisticas,
    usuario: AuthenticatedUser,
  ): Promise<EstadisticasResumen> {
    const [
      solicitudesPorEstadoCrudo,
      topLaboratorios,
      solicitudesPorTipoCrudo,
      solicitudesPorDivision,
      solicitudesPorFacultad,
      usoPorLaboratorio,
      usoPorDivision,
      usoPorFacultad,
      usoPorNivelCrudo,
      usoPorCategoriaYFacultadCrudo,
      laboratoriosActivos,
    ] = await Promise.all([
      this.contarSolicitudesPorEstado(filtros, usuario),
      this.contarSolicitudesAgrupadas(
        filtros,
        usuario,
        'laboratorio',
        TOP_LABORATORIOS,
      ),
      this.contarSolicitudesAgrupadas(filtros, usuario, 'tipoReserva'),
      this.contarSolicitudesPorDivision(filtros, usuario),
      this.contarSolicitudesAgrupadas(
        filtros,
        usuario,
        'facultad',
        TOP_FACULTADES,
      ),
      this.contarHorasUsoPorLaboratorio(filtros, usuario),
      this.contarHorasUsoAgrupado(filtros, usuario, 'division'),
      this.contarHorasUsoAgrupado(filtros, usuario, 'facultad'),
      this.contarHorasUsoAgrupado(filtros, usuario, 'nivel'),
      this.contarHorasUsoPorTipoYFacultad(filtros, usuario),
      this.laboratorioRepository.count({
        where: { estado: EstadoLaboratorio.ACTIVO },
      }),
    ]);

    const solicitudesPorEstado = {
      // REALIZADA cuenta como aprobada acá: sigue siendo una solicitud
      // aprobada, solo que ya se registró su uso real en bitácora — sin
      // esto, la tasa de aprobación bajaría artificialmente a medida que
      // las solicitudes aprobadas van cerrando su flujo.
      aprobadas:
        (solicitudesPorEstadoCrudo[EstadoSolicitud.APROBADA] ?? 0) +
        (solicitudesPorEstadoCrudo[EstadoSolicitud.REALIZADA] ?? 0),
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
      solicitudesPorDivision,
      solicitudesPorFacultad,
      usoPorLaboratorio: usoPorLaboratorio
        .slice(0, TOP_USO_LABORATORIO)
        .map(redondear),
      usoPorDivision: usoPorDivision.map(redondear),
      usoPorFacultad: usoPorFacultad.map(redondear),
      usoPorNivel: usoPorNivelCrudo.map((fila) =>
        redondear({ ...fila, nombre: nivelLabel(fila.nombre) }),
      ),
      usoPorCategoriaYFacultad: this.agruparPorCategoriaCerrada(
        usoPorCategoriaYFacultadCrudo,
      ),
    };
  }

  private async contarSolicitudesPorEstado(
    filtros: FiltrosEstadisticas,
    usuario: AuthenticatedUser,
  ): Promise<Record<string, number>> {
    const query = this.solicitudRepository
      .createQueryBuilder('solicitud')
      .select('solicitud.estado', 'estado')
      .addSelect('COUNT(*)', 'total')
      .groupBy('solicitud.estado');
    if (filtros.idDivision || filtros.nivel) {
      query.innerJoin('solicitud.facultad', 'facultad');
    }
    this.aplicarScopeUsuario(query, usuario);
    this.aplicarFiltrosSolicitud(query, filtros);

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
    usuario: AuthenticatedUser,
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
    if ((filtros.idDivision || filtros.nivel) && relacion !== 'facultad') {
      query.innerJoin('solicitud.facultad', 'facultad');
    }
    this.aplicarScopeUsuario(query, usuario);
    this.aplicarFiltrosSolicitud(
      query,
      filtros,
      relacion === 'facultad' ? 'entidad' : 'facultad',
    );
    if (limite) {
      query.limit(limite);
    }

    const filas = await query.getRawMany<{ nombre: string; total: string }>();
    return filas.map((fila) => ({
      nombre: fila.nombre,
      total: Number(fila.total),
    }));
  }

  /**
   * A diferencia de laboratorio/tipoReserva/facultad, solicitud no tiene una
   * relación directa a división — hay que pasar por facultad.
   */
  private async contarSolicitudesPorDivision(
    filtros: FiltrosEstadisticas,
    usuario: AuthenticatedUser,
  ): Promise<ConteoNombre[]> {
    const query = this.solicitudRepository
      .createQueryBuilder('solicitud')
      .innerJoin('solicitud.facultad', 'facultad')
      .innerJoin('facultad.division', 'division')
      .select('division.nombre', 'nombre')
      .addSelect('COUNT(*)', 'total')
      .groupBy('division.nombre')
      .orderBy('total', 'DESC');
    this.aplicarScopeUsuario(query, usuario);
    this.aplicarFiltrosSolicitud(query, filtros);

    const filas = await query.getRawMany<{ nombre: string; total: string }>();
    return filas.map((fila) => ({
      nombre: fila.nombre,
      total: Number(fila.total),
    }));
  }

  private necesitaJoinSolicitud(
    filtros: FiltrosEstadisticas,
    usuario: AuthenticatedUser,
  ): boolean {
    return (
      !!filtros.idPeriodo ||
      !!filtros.idFacultad ||
      !!filtros.idDivision ||
      !!filtros.nivel ||
      usuario.rol === 'docente'
    );
  }

  private async contarHorasUsoPorLaboratorio(
    filtros: FiltrosEstadisticas,
    usuario: AuthenticatedUser,
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

    if (filtros.idLaboratorio) {
      query.andWhere('laboratorio.id_laboratorio = :idLaboratorio', {
        idLaboratorio: filtros.idLaboratorio,
      });
    }

    if (this.necesitaJoinSolicitud(filtros, usuario)) {
      query.innerJoin(
        'solicitud_reserva',
        'solicitud',
        'solicitud.id_solicitud = registro.id_solicitud',
      );
    }
    if (filtros.idDivision || filtros.nivel) {
      query.innerJoin(
        'facultad',
        'facultad',
        'facultad.id_facultad = solicitud.id_facultad',
      );
    }
    if (usuario.rol === 'docente') {
      query.andWhere('solicitud.id_docente_encargado = :idUsuario', {
        idUsuario: usuario.id,
      });
    } else if (usuario.rol === 'laboratorista') {
      query.andWhere('registro.id_laboratorista = :idUsuario', {
        idUsuario: usuario.id,
      });
    }
    if (filtros.idPeriodo) {
      query.andWhere('solicitud.id_periodo = :idPeriodo', {
        idPeriodo: filtros.idPeriodo,
      });
    }
    if (filtros.idFacultad) {
      query.andWhere('solicitud.id_facultad = :idFacultad', {
        idFacultad: filtros.idFacultad,
      });
    }
    if (filtros.idDivision) {
      query.andWhere('facultad.id_division = :idDivision', {
        idDivision: filtros.idDivision,
      });
    }
    if (filtros.nivel) {
      query.andWhere('facultad.nivel = :nivel', { nivel: filtros.nivel });
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

  /**
   * Suma de horas de uso (bitácora) agrupada por división, facultad o nivel
   * (pregrado/posgrado). La bitácora llega a división/facultad/nivel solo a
   * través de la solicitud, así que un registro sin solicitud asociada no
   * entra acá.
   */
  private async contarHorasUsoAgrupado(
    filtros: FiltrosEstadisticas,
    usuario: AuthenticatedUser,
    agrupacion: 'division' | 'facultad' | 'nivel',
  ): Promise<ConteoNombre[]> {
    const query = this.registroUsoRepository
      .createQueryBuilder('registro')
      .innerJoin(
        'solicitud_reserva',
        'solicitud',
        'solicitud.id_solicitud = registro.id_solicitud',
      )
      .innerJoin(
        'facultad',
        'facultad',
        'facultad.id_facultad = solicitud.id_facultad',
      )
      .addSelect(
        'SUM(TIMESTAMPDIFF(MINUTE, registro.hora_inicio_real, registro.hora_fin_real)) / 60',
        'total',
      )
      .orderBy('total', 'DESC');

    if (agrupacion === 'division') {
      query
        .innerJoin(
          'division',
          'division',
          'division.id_division = facultad.id_division',
        )
        .addSelect('division.nombre', 'nombre')
        .groupBy('division.nombre');
    } else if (agrupacion === 'nivel') {
      query.addSelect('facultad.nivel', 'nombre').groupBy('facultad.nivel');
    } else {
      query.addSelect('facultad.nombre', 'nombre').groupBy('facultad.nombre');
    }

    if (usuario.rol === 'docente') {
      query.andWhere('solicitud.id_docente_encargado = :idUsuario', {
        idUsuario: usuario.id,
      });
    } else if (usuario.rol === 'laboratorista') {
      query.andWhere('registro.id_laboratorista = :idUsuario', {
        idUsuario: usuario.id,
      });
    }
    if (filtros.idPeriodo) {
      query.andWhere('solicitud.id_periodo = :idPeriodo', {
        idPeriodo: filtros.idPeriodo,
      });
    }
    if (filtros.idLaboratorio) {
      query.andWhere('registro.id_laboratorio = :idLaboratorio', {
        idLaboratorio: filtros.idLaboratorio,
      });
    }
    if (filtros.idFacultad) {
      query.andWhere('solicitud.id_facultad = :idFacultad', {
        idFacultad: filtros.idFacultad,
      });
    }
    if (filtros.idDivision) {
      query.andWhere('facultad.id_division = :idDivision', {
        idDivision: filtros.idDivision,
      });
    }
    if (filtros.nivel) {
      query.andWhere('facultad.nivel = :nivel', { nivel: filtros.nivel });
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

  /**
   * Matriz cruda "tipo de reserva real x facultad" (suma de horas) — se
   * agrupa por el nombre nativo de tipo_reserva porque el mapeo a la lista
   * cerrada de "Uso de Laboratorio" vive en JS (USO_LABORATORIO_MAP), no en
   * SQL; agruparPorCategoriaCerrada la colapsa después.
   */
  private async contarHorasUsoPorTipoYFacultad(
    filtros: FiltrosEstadisticas,
    usuario: AuthenticatedUser,
  ): Promise<UsoPorCategoriaYFacultad[]> {
    const query = this.registroUsoRepository
      .createQueryBuilder('registro')
      .innerJoin('registro.tipoReserva', 'tipoReserva')
      .innerJoin(
        'solicitud_reserva',
        'solicitud',
        'solicitud.id_solicitud = registro.id_solicitud',
      )
      .innerJoin(
        'facultad',
        'facultad',
        'facultad.id_facultad = solicitud.id_facultad',
      )
      .select('tipoReserva.nombre', 'categoria')
      .addSelect('facultad.nombre', 'facultad')
      .addSelect(
        'SUM(TIMESTAMPDIFF(MINUTE, registro.hora_inicio_real, registro.hora_fin_real)) / 60',
        'total',
      )
      .groupBy('tipoReserva.nombre')
      .addGroupBy('facultad.nombre');

    if (usuario.rol === 'docente') {
      query.andWhere('solicitud.id_docente_encargado = :idUsuario', {
        idUsuario: usuario.id,
      });
    } else if (usuario.rol === 'laboratorista') {
      query.andWhere('registro.id_laboratorista = :idUsuario', {
        idUsuario: usuario.id,
      });
    }
    if (filtros.idPeriodo) {
      query.andWhere('solicitud.id_periodo = :idPeriodo', {
        idPeriodo: filtros.idPeriodo,
      });
    }
    if (filtros.idLaboratorio) {
      query.andWhere('registro.id_laboratorio = :idLaboratorio', {
        idLaboratorio: filtros.idLaboratorio,
      });
    }
    if (filtros.idFacultad) {
      query.andWhere('solicitud.id_facultad = :idFacultad', {
        idFacultad: filtros.idFacultad,
      });
    }
    if (filtros.idDivision) {
      query.andWhere('facultad.id_division = :idDivision', {
        idDivision: filtros.idDivision,
      });
    }
    if (filtros.nivel) {
      query.andWhere('facultad.nivel = :nivel', { nivel: filtros.nivel });
    }

    const filas = await query.getRawMany<{
      categoria: string;
      facultad: string;
      total: string | null;
    }>();
    return filas.map((fila) => ({
      categoria: fila.categoria,
      facultad: fila.facultad,
      total: Number(fila.total ?? 0),
    }));
  }

  /**
   * tipo_reserva.nombre -> categoria de la lista cerrada "Uso de
   * Laboratorio" (mismo mapeo que el export a Excel, ver
   * USO_LABORATORIO_MAP) y re-suma lo que haya quedado separado por
   * compartir categoria. Se acumula por objeto, no por texto partido con
   * split(' ') -- categoria y facultad casi siempre traen espacios, un
   * split ingenuo mezclaria mal los nombres al reconstruirlos.
   */
  private agruparPorCategoriaCerrada(
    filas: UsoPorCategoriaYFacultad[],
  ): UsoPorCategoriaYFacultad[] {
    const acumulado = new Map<string, UsoPorCategoriaYFacultad>();
    for (const fila of filas) {
      const categoria = USO_LABORATORIO_MAP[fila.categoria] ?? fila.categoria;
      const clave = categoria + '||' + fila.facultad;
      const existente = acumulado.get(clave);
      if (existente) {
        existente.total += fila.total;
      } else {
        acumulado.set(clave, {
          categoria,
          facultad: fila.facultad,
          total: fila.total,
        });
      }
    }
    return [...acumulado.values()]
      .map((fila) => ({ ...fila, total: Math.round(fila.total * 10) / 10 }))
      .sort(
        (a, b) =>
          a.categoria.localeCompare(b.categoria) ||
          a.facultad.localeCompare(b.facultad),
      );
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

function redondear(fila: ConteoNombre): ConteoNombre {
  return { nombre: fila.nombre, total: Math.round(fila.total * 10) / 10 };
}

/** 'pregrado'/'posgrado' (valor crudo de la columna) -> etiqueta legible. */
function nivelLabel(nivel: string): string {
  return (nivel as NivelFacultad) === NivelFacultad.POSGRADO
    ? 'Posgrado'
    : 'Pregrado';
}
