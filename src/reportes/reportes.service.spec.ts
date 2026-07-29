import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { ReportesService } from './reportes.service';
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
} from './constantes/asistencias-excel.constants';

describe('ReportesService — export de asistencias', () => {
  let service: ReportesService;

  const periodo: Partial<PeriodoAcademico> = {
    idPeriodo: 1,
    nombre: '2026-2',
    fechaInicio: '2026-07-20',
    fechaFin: '2026-11-20',
    numSemanas: 16,
  };

  const registroConSolicitud: Partial<RegistroUso> = {
    idRegistro: 1,
    laboratorio: { nombre: 'Telecomunicaciones' } as Laboratorio,
    laboratorista: { nombre: 'Laboratorista Uno' } as any,
    tipoReserva: { nombre: 'Práctica libre' } as any,
    solicitud: {
      nombrePractica: 'Práctica de radiofrecuencia',
      facultad: {
        nombre: 'Ingeniería Electrónica',
        nivel: NivelFacultad.PREGRADO,
        division: { nombre: 'Arquitectura e Ingenierías' },
      } as Facultad,
      docenteEncargado: { nombre: 'Docente Uno' } as any,
      periodoAcademico: periodo as PeriodoAcademico,
    } as any,
    fecha: '2026-07-27',
    horaInicioReal: '08:00',
    horaFinReal: '10:00',
    numAsistentes: 5,
    novedad: null,
  };

  const registroSinSolicitudNiMapeo: Partial<RegistroUso> = {
    idRegistro: 2,
    laboratorio: { nombre: 'Laboratorio no mapeado' } as Laboratorio,
    laboratorista: { nombre: 'Laboratorista Uno' } as any,
    tipoReserva: { nombre: 'Semillero' } as any,
    solicitud: null,
    fecha: '2026-07-28',
    horaInicioReal: '14:00',
    horaFinReal: '16:00',
    numAsistentes: 3,
    novedad: 'Docente ausente',
  };

  const registroTesisConSolicitud: Partial<RegistroUso> = {
    idRegistro: 3,
    laboratorio: { nombre: 'Telecomunicaciones' } as Laboratorio,
    laboratorista: { nombre: 'Laboratorista Uno' } as any,
    tipoReserva: { nombre: 'Investigación / Tesis' } as any,
    solicitud: {
      nombrePractica: 'Tesis de antenas',
      facultad: {
        nombre: 'Ingeniería Electrónica',
        nivel: NivelFacultad.PREGRADO,
        division: { nombre: 'Arquitectura e Ingenierías' },
      } as Facultad,
      // El docente encargado SÍ existe en el sistema, pero la convención del
      // Excel exige "Estudiantes" para Investigación/Tesis y Semillero —
      // ver TIPOS_DOCENTE_ES_ESTUDIANTES.
      docenteEncargado: { nombre: 'Docente Uno' } as any,
      periodoAcademico: periodo as PeriodoAcademico,
    } as any,
    fecha: '2026-07-29',
    horaInicioReal: '08:00',
    horaFinReal: '09:00',
    numAsistentes: 1,
    novedad: null,
  };

  beforeEach(async () => {
    const queryBuilderMock = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest
        .fn()
        .mockResolvedValue([
          registroConSolicitud,
          registroSinSolicitudNiMapeo,
          registroTesisConSolicitud,
        ]),
    };

    const registroUsoRepository = {
      createQueryBuilder: jest.fn(() => queryBuilderMock),
    };
    const periodoRepository = {
      findOne: jest.fn().mockResolvedValue(periodo),
      createQueryBuilder: jest.fn(),
    };
    const laboratorioRepository = { find: jest.fn().mockResolvedValue([]) };
    const facultadRepository = { find: jest.fn().mockResolvedValue([]) };
    const divisionRepository = { find: jest.fn().mockResolvedValue([]) };

    const repos = new Map<unknown, unknown>([
      [RegistroUso, registroUsoRepository],
      [PeriodoAcademico, periodoRepository],
      [Laboratorio, laboratorioRepository],
      [Facultad, facultadRepository],
      [Division, divisionRepository],
    ]);
    const dataSourceMock = {
      getRepository: jest.fn((entity: unknown) => repos.get(entity)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportesService,
        { provide: DataSource, useValue: dataSourceMock },
      ],
    }).compile();

    service = module.get<ReportesService>(ReportesService);
  });

  describe('validar', () => {
    it('reporta el laboratorio sin hoja y el registro sin solicitud, sin bloquear', async () => {
      const reporte = await service.validar({ idPeriodo: 1 });

      expect(reporte.totalRegistros).toBe(3);
      expect(reporte.problemas).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            idRegistro: 2,
            tipo: 'laboratorio_sin_hoja',
          }),
          expect.objectContaining({
            idRegistro: 2,
            tipo: 'sin_solicitud_asociada',
          }),
        ]),
      );
    });
  });

  describe('exportarExcel', () => {
    it('genera un libro con las 14 hojas/tablas exactas, headers correctos y formatos', async () => {
      const { buffer, nombreArchivo } = await service.exportarExcel({
        idPeriodo: 1,
      });

      expect(nombreArchivo).toBe('ASISTENCIAS_EN_LABS_2026-2.xlsx');

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

      expect(workbook.worksheets).toHaveLength(14);
      for (const area of AREAS) {
        const worksheet = workbook.getWorksheet(area.hoja);
        expect(worksheet).toBeDefined();

        // exceljs, al releer un libro ya escrito, expone la tabla como
        // { table: { name, columns, tableRef, ... } } — distinto de la forma
        // "plana" que devuelve addTable() al escribir (ver EXPORT-NOTES.md,
        // verificado con una prueba manual contra la propia librería).
        const tabla = worksheet!.getTable(area.tabla) as unknown as {
          table: {
            name: string;
            columns: { name: string }[];
            tableRef: string;
          };
        };
        expect(tabla).toBeDefined();
        expect(tabla.table.name).toBe(area.tabla);
        expect(tabla.table.columns.map((c) => c.name)).toEqual(
          ENCABEZADOS_COLUMNAS,
        );

        // También vía la fila de encabezado real (A–O), como lo vería Power
        // Query — el resto de la fila 1 (P en adelante) son las listas
        // auxiliares Q–W, no parte de la tabla.
        const encabezados = (worksheet!.getRow(1).values as unknown[]).slice(
          1,
          1 + ENCABEZADOS_COLUMNAS.length,
        );
        expect(encabezados).toEqual(ENCABEZADOS_COLUMNAS);
      }

      // La fila con solicitud cae en LAB ELECTRONICA (Telecomunicaciones).
      const hojaElectronica = workbook.getWorksheet('LAB ELECTRONICA')!;
      expect(hojaElectronica.getCell('A2').value).toBe(2); // semana calculada
      expect(hojaElectronica.getCell('F2').value).toBe('Pregrado');
      expect(hojaElectronica.getCell('J2').value).toBe('TELECOMUNICACIONES ');
      expect(hojaElectronica.getCell('E2').numFmt).toBe('0.00');
      expect(hojaElectronica.getCell('B2').numFmt).toBe('yyyy-mm-dd');

      // El registro sin mapeo de laboratorio (idRegistro 2) no aparece en
      // ninguna hoja — solo caen las otras dos filas (idRegistro 1 y 3).
      const totalFilas = AREAS.reduce(
        (total, area) =>
          total +
          contarFilasDeDatos(workbook.getWorksheet(area.hoja)!, area.tabla),
        0,
      );
      expect(totalFilas).toBe(2);
    });

    it('usa "Estudiantes" como docente para Investigación/Tesis, aunque exista un docente encargado real', async () => {
      const { buffer } = await service.exportarExcel({ idPeriodo: 1 });
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

      const hojaElectronica = workbook.getWorksheet('LAB ELECTRONICA')!;
      // Fila 2: idRegistro 1 (Práctica libre). Fila 3: idRegistro 3
      // (Investigación/Tesis) — ambos ordenados por fecha ASC.
      expect(hojaElectronica.getCell('I3').value).toBe('Estudiantes');
      expect(hojaElectronica.getCell('I2').value).toBe('Docente Uno');
    });
  });
});

/** Cuenta filas de datos (sin encabezado) a partir de tableRef, ej. "A1:O3" → 2. */
function contarFilasDeDatos(
  worksheet: ExcelJS.Worksheet,
  nombreTabla: string,
): number {
  const tabla = worksheet.getTable(nombreTabla) as unknown as {
    table: { tableRef: string };
  };
  const [, hasta] = tabla.table.tableRef.split(':');
  const filaFinal = Number(hasta.replace(/[^0-9]/g, ''));
  return filaFinal - 1;
}
