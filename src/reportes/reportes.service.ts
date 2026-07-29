import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { RegistroUso } from 'src/bitacora/entities/registro-uso.entity';
import { PeriodoAcademico } from 'src/catalogos/entities/periodo-academico.entity';
import { Laboratorio } from 'src/laboratorios/entities/laboratorio.entity';
import {
  Facultad,
  NivelFacultad,
} from 'src/catalogos/entities/facultad.entity';
import { Division } from 'src/catalogos/entities/division.entity';
import {
  AREAS,
  ENCABEZADOS_COLUMNAS,
  LABORATORIO_A_HOJA,
  NIVEL_LISTA_CERRADA,
  OBSERVACIONES_LISTA_CERRADA,
  SEMANAS_LISTA,
  TIPOS_DOCENTE_ES_ESTUDIANTES,
  USO_LABORATORIO_LISTA_CERRADA,
  USO_LABORATORIO_MAP,
  nombreExcelLaboratorio,
  observacionExcel,
} from './constantes/asistencias-excel.constants';
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
  private readonly laboratorioRepository: Repository<Laboratorio>;
  private readonly facultadRepository: Repository<Facultad>;
  private readonly divisionRepository: Repository<Division>;

  constructor(private readonly dataSource: DataSource) {
    this.registroUsoRepository = this.dataSource.getRepository(RegistroUso);
    this.periodoRepository = this.dataSource.getRepository(PeriodoAcademico);
    this.laboratorioRepository = this.dataSource.getRepository(Laboratorio);
    this.facultadRepository = this.dataSource.getRepository(Facultad);
    this.divisionRepository = this.dataSource.getRepository(Division);
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

    const hoy = new Date().toISOString().slice(0, 10);
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

    const usoExcel =
      USO_LABORATORIO_MAP[registro.tipoReserva.nombre] ??
      registro.tipoReserva.nombre;
    if (!USO_LABORATORIO_MAP[registro.tipoReserva.nombre]) {
      problemas.push({
        idRegistro: registro.idRegistro,
        tipo: 'uso_fuera_de_lista',
        detalle: `"${registro.tipoReserva.nombre}" no está en la lista cerrada de "Uso de Laboratorio" — se exporta tal cual.`,
      });
    }

    const observaciones = observacionExcel(registro.novedad);
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
      : (solicitud?.docenteEncargado.nombre ?? '');

    const semana = solicitud
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
      nivel: solicitud
        ? solicitud.facultad.nivel === NivelFacultad.POSGRADO
          ? 'Posgrado'
          : 'Pregrado'
        : '',
      division: solicitud?.facultad.division.nombre ?? '',
      facultad: solicitud?.facultad.nombre ?? '',
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
    const [laboratorios, facultades, divisiones] = await Promise.all([
      this.laboratorioRepository.find({ order: { nombre: 'ASC' } }),
      this.facultadRepository.find({ order: { nombre: 'ASC' } }),
      this.divisionRepository.find({ order: { nombre: 'ASC' } }),
    ]);

    const workbook = new ExcelJS.Workbook();

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
      escribirListasAuxiliares(worksheet, laboratorios, facultades, divisiones);
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

/**
 * Columnas Q–W: listas de referencia (ver GAP-REPORT.md). Q y "Facultad" (T,
 * ver nota abajo) salen del catálogo real en vez de una lista fija, para no
 * inventar los nombres que el usuario no dio completos — ver EXPORT-NOTES.md.
 * No se reconstruyen las validaciones de datos (dropdowns) sobre A/F/G/H/J/N/O
 * porque este archivo no se edita a mano — es una foto generada, no una
 * plantilla de captura (ver EXPORT-NOTES.md).
 */
function escribirListasAuxiliares(
  worksheet: ExcelJS.Worksheet,
  laboratorios: Laboratorio[],
  facultades: Facultad[],
  divisiones: Division[],
): void {
  const columnas: Array<{
    letra: string;
    encabezado: string;
    valores: unknown[];
  }> = [
    {
      letra: 'Q',
      encabezado: 'Lista laboratorios',
      valores: laboratorios.map((l) => nombreExcelLaboratorio(l.nombre)),
    },
    { letra: 'R', encabezado: 'Lista de Semanas', valores: [...SEMANAS_LISTA] },
    {
      letra: 'S',
      encabezado: 'Division',
      valores: divisiones.map((d) => d.nombre),
    },
    {
      letra: 'T',
      encabezado: 'Facultad',
      valores: facultades.map((f) => f.nombre),
    },
    { letra: 'U', encabezado: 'Nivel', valores: [...NIVEL_LISTA_CERRADA] },
    {
      letra: 'V',
      encabezado: 'Uso de Laboratorio',
      valores: [...USO_LABORATORIO_LISTA_CERRADA],
    },
    {
      letra: 'W',
      encabezado: 'Observaciones',
      valores: [...OBSERVACIONES_LISTA_CERRADA],
    },
  ];

  for (const columna of columnas) {
    worksheet.getCell(`${columna.letra}1`).value = columna.encabezado;
    columna.valores.forEach((valor, indice) => {
      worksheet.getCell(`${columna.letra}${indice + 2}`).value = valor as
        string | number;
    });
  }
}
