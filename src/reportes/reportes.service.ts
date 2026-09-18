import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { RegistroUso } from 'src/bitacora/entities/registro-uso.entity';
import { PeriodoAcademico } from 'src/catalogos/entities/periodo-academico.entity';
import { NivelFacultad } from 'src/catalogos/entities/facultad.entity';
import {
  AREAS,
  ENCABEZADOS_COLUMNAS,
  LABORATORIO_A_HOJA,
  OBSERVACIONES_LISTA_CERRADA,
  TIPOS_DOCENTE_ES_ESTUDIANTES,
  USO_LABORATORIO_LISTA_CERRADA,
  USO_LABORATORIO_MAP,
  nombreExcelLaboratorio,
  observacionExcel,
} from './constantes/asistencias-excel.constants';
import { hoyBogotaISO } from 'src/common/utils/fecha-horario.util';
import { calcularSemana } from './utils/calcular-semana.util';
import { calcularTiempoDeUso } from './utils/tiempo-de-uso.util';
import { ExportarAsistenciasQueryDto } from './dto/exportar-asistencias-query.dto';
import {
  FilaAsistencia,
  ProblemaValidacion,
  ReporteAsistencias,
} from './reportes.types';

@Injectable()
export class ReportesService {
  private readonly registroUsoRepository: Repository<RegistroUso>;
  private readonly periodoRepository: Repository<PeriodoAcademico>;

  constructor(private readonly dataSource: DataSource) {
    this.registroUsoRepository = this.dataSource.getRepository(RegistroUso);
    this.periodoRepository = this.dataSource.getRepository(PeriodoAcademico);
  }

  /**
   * "Periodo activo" = fecha_inicio <= hoy <= fecha_fin. Si ninguno está
   * vigente hoy, cae al más reciente (por fecha_fin) — nunca deja el export
   * sin rango si hay al menos un periodo cargado.
   */
  private async resolverRango(filtros: ExportarAsistenciasQueryDto): Promise<{
    fechaDesde: string;
    fechaHasta: string;
    periodoNombre: string;
  }> {
    if (filtros.idPeriodo) {
      const periodo = await this.periodoRepository.findOne({
        where: { idPeriodo: filtros.idPeriodo },
      });
      if (!periodo) {
        throw new HttpException(
          'Periodo académico no encontrado',
          HttpStatus.NOT_FOUND,
        );
      }
      return {
        fechaDesde: filtros.fechaDesde ?? periodo.fechaInicio,
        fechaHasta: filtros.fechaHasta ?? periodo.fechaFin,
        periodoNombre: periodo.nombre,
      };
    }

    if (filtros.fechaDesde || filtros.fechaHasta) {
      return {
        fechaDesde: filtros.fechaDesde ?? '0001-01-01',
        fechaHasta: filtros.fechaHasta ?? '9999-12-31',
        periodoNombre: 'personalizado',
      };
    }

    const hoy = hoyBogotaISO();
    const activo = await this.periodoRepository
      .createQueryBuilder('periodo')
      .where('periodo.fecha_inicio <= :hoy', { hoy })
      .andWhere('periodo.fecha_fin >= :hoy', { hoy })
      .getOne();
    if (activo) {
      return {
        fechaDesde: activo.fechaInicio,
        fechaHasta: activo.fechaFin,
        periodoNombre: activo.nombre,
      };
    }

    const reciente = await this.periodoRepository
      .createQueryBuilder('periodo')
      .orderBy('periodo.fecha_fin', 'DESC')
      .getOne();
    if (!reciente) {
      throw new HttpException(
        'No hay periodos académicos configurados',
        HttpStatus.NOT_FOUND,
      );
    }
    return {
      fechaDesde: reciente.fechaInicio,
      fechaHasta: reciente.fechaFin,
      periodoNombre: reciente.nombre,
    };
  }

  private construirFila(
    registro: RegistroUso,
    problemas: ProblemaValidacion[],
  ): { hoja: string | null; fila: FilaAsistencia } {
    const solicitud = registro.solicitud ?? null;
    const nombreLab = registro.laboratorio.nombre;
    const hoja = LABORATORIO_A_HOJA[nombreLab] ?? null;
    if (!hoja) {
      problemas.push({
        idRegistro: registro.idRegistro,
        tipo: 'laboratorio_sin_hoja',
        detalle: `El laboratorio "${nombreLab}" no está mapeado a ninguna hoja del Excel — no se incluye en el archivo.`,
      });
    }

    if (!solicitud) {
      problemas.push({
        idRegistro: registro.idRegistro,
        tipo: 'sin_solicitud_asociada',
        detalle:
          'Registro de bitácora sin solicitud asociada: Nivel, Division, Facultad, Docente y Materia quedan vacíos en esta fila.',
      });
    }

    // El laboratorista la elige libremente al registrar el uso (ver
    // CreateRegistroUsoDto.usoLaboratorio) — para registros históricos sin
    // ese campo (previos a este cambio) se cae al mapeo viejo desde "Tipo
    // de reserva" como mejor esfuerzo.
    const usoExcel =
      registro.usoLaboratorio ||
      USO_LABORATORIO_MAP[registro.tipoReserva.nombre] ||
      registro.tipoReserva.nombre;
    if (!USO_LABORATORIO_LISTA_CERRADA.includes(usoExcel)) {
      problemas.push({
        idRegistro: registro.idRegistro,
        tipo: 'uso_fuera_de_lista',
        detalle: `"${usoExcel}" no está en la lista cerrada de "Uso de Laboratorio" — se exporta tal cual.`,
      });
    }

    const observaciones = observacionExcel(registro.observaciones);
    if (!OBSERVACIONES_LISTA_CERRADA.includes(observaciones)) {
      problemas.push({
        idRegistro: registro.idRegistro,
        tipo: 'observacion_fuera_de_lista',
        detalle: `"${observaciones}" no está en la lista cerrada de "Observaciones" — se exporta tal cual.`,
      });
    }

    const esTesisOSemillero = TIPOS_DOCENTE_ES_ESTUDIANTES.includes(
      registro.tipoReserva.nombre,
    );
    const docente = esTesisOSemillero
      ? 'Estudiantes'
      : (solicitud?.docenteEncargado?.nombre ?? '');

    // Sin periodo académico (evento especial, ver SolicitudReserva.idPeriodo)
    // no hay semana que calcular — mismo criterio que "sin solicitud".
    const semana =
      solicitud && solicitud.periodoAcademico
        ? calcularSemana(registro.fecha, solicitud.periodoAcademico)
        : 'Intersemestral';

    const fila: FilaAsistencia = {
      semana,
      fecha: registro.fecha,
      horaInicio: registro.horaInicioReal,
      horaFin: registro.horaFinReal,
      tiempoDeUso: calcularTiempoDeUso(
        registro.horaInicioReal,
        registro.horaFinReal,
      ),
      nivel: solicitud?.facultad
        ? solicitud.facultad.nivel === NivelFacultad.POSGRADO
          ? 'Posgrado'
          : 'Pregrado'
        : '',
      division: solicitud?.facultad?.division.nombre ?? '',
      facultad: solicitud?.facultad?.nombre ?? '',
      docente,
      laboratorioExcel: nombreExcelLaboratorio(nombreLab),
      numEstudiantes: registro.numAsistentes,
      materia: solicitud?.nombrePractica ?? '',
      laboratorista: registro.laboratorista.nombre,
      usoLaboratorio: usoExcel,
      observaciones,
    };

    return { hoja, fila };
  }

  async generarReporte(
    filtros: ExportarAsistenciasQueryDto,
  ): Promise<ReporteAsistencias> {
    const { fechaDesde, fechaHasta, periodoNombre } =
      await this.resolverRango(filtros);

    const registros = await this.registroUsoRepository
      .createQueryBuilder('registro')
      .leftJoinAndSelect('registro.laboratorio', 'laboratorio')
      .leftJoinAndSelect('registro.laboratorista', 'laboratorista')
      .leftJoinAndSelect('registro.tipoReserva', 'tipoReserva')
      .leftJoinAndSelect('registro.solicitud', 'solicitud')
      .leftJoinAndSelect('solicitud.facultad', 'facultad')
      .leftJoinAndSelect('facultad.division', 'division')
      .leftJoinAndSelect('solicitud.docenteEncargado', 'docenteEncargado')
      .leftJoinAndSelect('solicitud.periodoAcademico', 'periodoAcademico')
      .where('registro.fecha >= :fechaDesde', { fechaDesde })
      .andWhere('registro.fecha <= :fechaHasta', { fechaHasta })
      .orderBy('registro.fecha', 'ASC')
      .addOrderBy('registro.hora_inicio_real', 'ASC')
      .getMany();

    const problemas: ProblemaValidacion[] = [];
    const filasPorHoja = new Map<string, FilaAsistencia[]>(
      AREAS.map((area) => [area.hoja, []]),
    );

    for (const registro of registros) {
      const { hoja, fila } = this.construirFila(registro, problemas);
      if (hoja) {
        filasPorHoja.get(hoja)!.push(fila);
      }
    }

    return {
      periodoNombre,
      fechaDesde,
      fechaHasta,
      totalRegistros: registros.length,
      filasPorHoja,
      problemas,
    };
  }

  async validar(filtros: ExportarAsistenciasQueryDto): Promise<{
    periodo: string;
    fechaDesde: string;
    fechaHasta: string;
    totalRegistros: number;
    totalProblemas: number;
    problemas: ProblemaValidacion[];
  }> {
    const reporte = await this.generarReporte(filtros);
    return {
      periodo: reporte.periodoNombre,
      fechaDesde: reporte.fechaDesde,
      fechaHasta: reporte.fechaHasta,
      totalRegistros: reporte.totalRegistros,
      totalProblemas: reporte.problemas.length,
      problemas: reporte.problemas,
    };
  }

  async exportarExcel(
    filtros: ExportarAsistenciasQueryDto,
  ): Promise<{ buffer: Buffer; nombreArchivo: string }> {
    const reporte = await this.generarReporte(filtros);
    const todasLasFilas = [...reporte.filasPorHoja.values()].flat();

    const workbook = new ExcelJS.Workbook();

    // Primera hoja: totales de horas de uso por laboratorio/división/facultad
    // — antes este export no tenía ningún resumen, solo listas planas de
    // registros; esto es lo único que alguien realmente necesita mirar de
    // entrada (ver conversación con el usuario sobre qué sobraba/faltaba).
    escribirResumen(
      workbook.addWorksheet('Resumen'),
      construirResumen(todasLasFilas),
    );

    for (const area of AREAS) {
      const worksheet = workbook.addWorksheet(area.hoja);
      const filas = reporte.filasPorHoja.get(area.hoja) ?? [];

      worksheet.addTable({
        name: area.tabla,
        ref: 'A1',
        headerRow: true,
        style: { theme: 'TableStyleMedium2', showRowStripes: true },
        columns: ENCABEZADOS_COLUMNAS.map((nombre) => ({ name: nombre })),
        rows: filas.map((fila) => filaAColumnas(fila)),
      });

      aplicarFormatosDeColumna(worksheet, filas.length);
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const nombreArchivo = `ASISTENCIAS_EN_LABS_${reporte.periodoNombre}.xlsx`;

    return { buffer, nombreArchivo };
  }
}

function filaAColumnas(fila: FilaAsistencia): unknown[] {
  return [
    fila.semana,
    fila.fecha,
    horaAFraccionDeDia(fila.horaInicio),
    horaAFraccionDeDia(fila.horaFin),
    fila.tiempoDeUso,
    fila.nivel,
    fila.division,
    fila.facultad,
    fila.docente,
    fila.laboratorioExcel,
    fila.numEstudiantes,
    fila.materia,
    fila.laboratorista,
    fila.usoLaboratorio,
    fila.observaciones,
  ];
}

/** Excel guarda horas como fracción de un día (0.5 = mediodía). */
function horaAFraccionDeDia(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return (h * 60 + m) / (24 * 60);
}

function aplicarFormatosDeColumna(
  worksheet: ExcelJS.Worksheet,
  totalFilas: number,
): void {
  if (totalFilas === 0) {
    return;
  }
  const ultimaFila = totalFilas + 1; // +1 por el encabezado
  for (let fila = 2; fila <= ultimaFila; fila++) {
    worksheet.getCell(`B${fila}`).numFmt = 'yyyy-mm-dd';
    worksheet.getCell(`C${fila}`).numFmt = 'h:mm';
    worksheet.getCell(`D${fila}`).numFmt = 'h:mm';
    worksheet.getCell(`E${fila}`).numFmt = '0.00';
  }
}

interface FilaResumen {
  nombre: string;
  horas: number;
}

interface Resumen {
  porLaboratorio: FilaResumen[];
  porDivision: FilaResumen[];
  porFacultad: FilaResumen[];
}

/** Suma fila.tiempoDeUso (horas) agrupado por laboratorio/división/facultad
 * — a partir de las mismas filas ya calculadas para las 14 hojas, así que no
 * hace ninguna consulta extra. Las filas sin solicitud asociada (Division/
 * Facultad vacíos) simplemente no aportan a esas dos agrupaciones, pero sí a
 * la de laboratorio. Ordenado de mayor a menor uso. */
function construirResumen(filas: FilaAsistencia[]): Resumen {
  const porLaboratorio = new Map<string, number>();
  const porDivision = new Map<string, number>();
  const porFacultad = new Map<string, number>();

  const sumar = (
    mapa: Map<string, number>,
    clave: string,
    horas: number,
  ): void => {
    if (!clave) {
      return;
    }
    mapa.set(clave, (mapa.get(clave) ?? 0) + horas);
  };

  for (const fila of filas) {
    sumar(porLaboratorio, fila.laboratorioExcel, fila.tiempoDeUso);
    sumar(porDivision, fila.division, fila.tiempoDeUso);
    sumar(porFacultad, fila.facultad, fila.tiempoDeUso);
  }

  const aLista = (mapa: Map<string, number>): FilaResumen[] =>
    [...mapa.entries()]
      .map(([nombre, horas]) => ({
        nombre,
        horas: Math.round(horas * 100) / 100,
      }))
      .sort((a, b) => b.horas - a.horas);

  return {
    porLaboratorio: aLista(porLaboratorio),
    porDivision: aLista(porDivision),
    porFacultad: aLista(porFacultad),
  };
}

/** Tres bloques apilados (Laboratorio / División / Facultad), cada uno con
 * su propio título y encabezado — se escriben con celdas planas en vez de
 * addTable para no lidiar con nombres/rangos de tabla superpuestos. */
function escribirResumen(worksheet: ExcelJS.Worksheet, resumen: Resumen): void {
  worksheet.getColumn('A').width = 42;
  worksheet.getColumn('B').width = 14;

  let fila = 1;
  const escribirBloque = (titulo: string, datos: FilaResumen[]): void => {
    const tituloCelda = worksheet.getCell(`A${fila}`);
    tituloCelda.value = titulo;
    tituloCelda.font = { bold: true, size: 13 };
    fila += 1;

    const encabezadoNombre = worksheet.getCell(`A${fila}`);
    const encabezadoHoras = worksheet.getCell(`B${fila}`);
    encabezadoNombre.value = 'Nombre';
    encabezadoHoras.value = 'Horas de uso';
    encabezadoNombre.font = { bold: true };
    encabezadoHoras.font = { bold: true };
    fila += 1;

    if (datos.length === 0) {
      worksheet.getCell(`A${fila}`).value = 'Sin registros en el periodo.';
      fila += 2;
      return;
    }

    for (const item of datos) {
      worksheet.getCell(`A${fila}`).value = item.nombre;
      const celdaHoras = worksheet.getCell(`B${fila}`);
      celdaHoras.value = item.horas;
      celdaHoras.numFmt = '0.00';
      fila += 1;
    }
    fila += 1; // fila en blanco entre bloques
  };

  escribirBloque('Uso de laboratorios', resumen.porLaboratorio);
  escribirBloque('Uso por división', resumen.porDivision);
  escribirBloque('Uso por facultad', resumen.porFacultad);
}
