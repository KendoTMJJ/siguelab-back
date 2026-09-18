import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { DataSource, In, IsNull, Not } from 'typeorm';
import { SolicitudesService } from './solicitudes.service';
import { NotificacionesService } from 'src/notificaciones/notificaciones.service';
import {
  Laboratorio,
  EstadoLaboratorio,
  ModoReservaLaboratorio,
} from 'src/laboratorios/entities/laboratorio.entity';
import { EspacioAcademico } from 'src/catalogos/entities/espacio-academico.entity';
import { EspacioLaboratorio } from 'src/laboratorios/entities/espacio-laboratorio.entity';
import { DocenteLaboratorio } from 'src/laboratorios/entities/docente-laboratorio.entity';
import { LaboratoristaLaboratorio } from 'src/laboratorios/entities/laboratorista-laboratorio.entity';
import { TipoReserva } from 'src/catalogos/entities/tipo-reserva.entity';
import { PeriodoAcademico } from 'src/catalogos/entities/periodo-academico.entity';
import { Facultad } from 'src/catalogos/entities/facultad.entity';
import { Usuario } from 'src/usuarios/entities/usuario.entity';
import { HorarioAcademico } from 'src/horarios-academicos/entities/horario-academico.entity';
import { Rol } from 'src/roles/entities/rol.entity';
import {
  EstadoSolicitud,
  SolicitudReserva,
} from './entities/solicitud-reserva.entity';
import { Firma } from './entities/firma.entity';
import { SolicitudEvento } from './entities/solicitud-evento.entity';
import { CreateSolicitudDirectaLoteDto } from './dto/create-solicitud-directa-lote.dto';
import type { AuthenticatedUser } from 'src/auth/decorators/current-user.decorator';

describe('SolicitudesService — evento especial (lote)', () => {
  let service: SolicitudesService;

  let solicitudRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
    update: jest.Mock;
  };
  let laboratorioRepository: { findOne: jest.Mock };
  let espacioAcademicoRepository: { findOne: jest.Mock };
  let espacioLaboratorioRepository: { exists: jest.Mock };
  let docenteLaboratorioRepository: { exists: jest.Mock };
  let laboratoristaLaboratorioRepository: {
    exists: jest.Mock;
    find: jest.Mock;
  };
  let tipoReservaRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let periodoAcademicoRepository: { findOne: jest.Mock };
  let facultadRepository: { findOne: jest.Mock };
  let usuarioRepository: { findOne: jest.Mock; find: jest.Mock };
  let horarioAcademicoRepository: { createQueryBuilder: jest.Mock };
  let rolRepository: { findOne: jest.Mock };
  let eventoRepository: { create: jest.Mock; save: jest.Mock };

  let notificacionesService: { notificar: jest.Mock };
  let transactionManager: {
    getRepository: jest.Mock;
  };
  let solicitudRepoTx: { create: jest.Mock; save: jest.Mock };
  let firmaRepoTx: { create: jest.Mock; save: jest.Mock };

  const laboratorista: AuthenticatedUser = {
    id: 'b1f0c1d2-1111-4a2b-9c3d-000000000001',
    rol: 'laboratorista',
    correo: 'lab@usantoto.edu.co',
    nombre: 'Laboratorista Uno',
  } as AuthenticatedUser;

  const tipoPracticaLibre: TipoReserva = {
    idTipo: 3,
    nombre: 'Práctica libre',
    esExclusiva: false,
    requiereEspacio: false,
  } as TipoReserva;

  const laboratorio: Laboratorio = {
    idLaboratorio: 1,
    capacidad: 30,
    estado: EstadoLaboratorio.ACTIVO,
    modoReserva: ModoReservaLaboratorio.ESTANDAR,
  } as Laboratorio;

  const periodo: PeriodoAcademico = {
    idPeriodo: 1,
    fechaInicio: '2030-01-01',
    fechaFin: '2030-12-31',
    numSemanas: 16,
  } as PeriodoAcademico;

  const facultad: Facultad = { idFacultad: 1 } as Facultad;

  const dtoBase: CreateSolicitudDirectaLoteDto = {
    idDocenteEncargado: 'b1f0c1d2-2222-4a2b-9c3d-000000000002',
    responsable: 'Comité de Bienestar Universitario',
    idLaboratorio: 1,
    idTipo: 3,
    idEspacio: 1,
    idFacultad: 1,
    idPeriodo: 1,
    grupoAsignatura: 'G1',
    numGruposTrabajo: 2,
    horaInicio: '08:00',
    horaFin: '10:00',
    nombrePractica: 'Feria de ciencias',
    numPersonas: 10,
    fechas: ['2030-10-12', '2030-10-13', '2030-10-14'],
  };

  beforeEach(async () => {
    solicitudRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    laboratorioRepository = {
      findOne: jest.fn().mockResolvedValue(laboratorio),
    };
    espacioAcademicoRepository = {
      findOne: jest.fn().mockResolvedValue({ idEspacio: 1 }),
    };
    espacioLaboratorioRepository = {
      exists: jest.fn().mockResolvedValue(true),
    };
    docenteLaboratorioRepository = {
      exists: jest.fn().mockResolvedValue(true),
    };
    laboratoristaLaboratorioRepository = {
      exists: jest.fn().mockResolvedValue(true),
      find: jest.fn().mockResolvedValue([]),
    };
    tipoReservaRepository = {
      findOne: jest.fn().mockResolvedValue(tipoPracticaLibre),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ ...data, idTipo: 3 })),
    };
    periodoAcademicoRepository = {
      findOne: jest.fn().mockResolvedValue(periodo),
    };
    facultadRepository = { findOne: jest.fn().mockResolvedValue(facultad) };
    usuarioRepository = {
      findOne: jest.fn().mockResolvedValue({
        idUsuario: dtoBase.idDocenteEncargado,
        correo: 'docente@usantoto.edu.co',
      }),
      find: jest.fn().mockResolvedValue([]),
    };
    horarioAcademicoRepository = {
      createQueryBuilder: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
    };
    rolRepository = { findOne: jest.fn().mockResolvedValue(null) };
    eventoRepository = {
      create: jest.fn((data) => data),
      save: jest.fn().mockResolvedValue(undefined),
    };

    notificacionesService = {
      notificar: jest.fn().mockResolvedValue(undefined),
    };

    solicitudRepoTx = {
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn((data) =>
        Promise.resolve({
          ...data,
          idSolicitud: Math.floor(Math.random() * 100000),
        }),
      ),
    };
    firmaRepoTx = {
      create: jest.fn((data) => data),
      save: jest.fn().mockResolvedValue(undefined),
    };
    transactionManager = {
      getRepository: jest.fn((entity) => {
        if (entity === SolicitudReserva) return solicitudRepoTx;
        if (entity === Firma) return firmaRepoTx;
        throw new Error(`Repositorio no mockeado en la transacción: ${entity}`);
      }),
    };

    const dataSourceMock = {
      getRepository: jest.fn((entity) => {
        if (entity === SolicitudReserva) return solicitudRepository;
        if (entity === Firma) return firmaRepoTx;
        if (entity === Laboratorio) return laboratorioRepository;
        if (entity === EspacioAcademico) return espacioAcademicoRepository;
        if (entity === EspacioLaboratorio) return espacioLaboratorioRepository;
        if (entity === DocenteLaboratorio) return docenteLaboratorioRepository;
        if (entity === LaboratoristaLaboratorio)
          return laboratoristaLaboratorioRepository;
        if (entity === TipoReserva) return tipoReservaRepository;
        if (entity === PeriodoAcademico) return periodoAcademicoRepository;
        if (entity === Facultad) return facultadRepository;
        if (entity === Usuario) return usuarioRepository;
        if (entity === HorarioAcademico) return horarioAcademicoRepository;
        if (entity === Rol) return rolRepository;
        if (entity === SolicitudEvento) return eventoRepository;
        throw new Error(`Repositorio no mockeado: ${entity}`);
      }),
      transaction: jest.fn((fn: (manager: unknown) => unknown) =>
        fn(transactionManager),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolicitudesService,
        { provide: DataSource, useValue: dataSourceMock },
        { provide: NotificacionesService, useValue: notificacionesService },
      ],
    }).compile();

    service = module.get<SolicitudesService>(SolicitudesService);

    // verificarDisponibilidad ya se prueba indirectamente en create()/
    // crearDirecta() (mismo método); acá se mockea para aislar la lógica
    // NUEVA de crearDirectaLote (todo-o-nada, N solicitudes, idLoteEspecial
    // compartido) sin repetir el mock de horarioAcademico/solicitudes que
    // ya cubre esa pieza.
    jest
      .spyOn<any, any>(service, 'verificarDisponibilidad')
      .mockResolvedValue({ disponible: true });

    // findOne recarga la solicitud con relaciones completas — no es lo que
    // se prueba acá, así que se devuelve tal cual la creada.
    jest
      .spyOn(service, 'findOne')
      .mockImplementation((id: number) =>
        Promise.resolve({ idSolicitud: id } as SolicitudReserva),
      );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('crearDirectaLote', () => {
    it('crea una SolicitudReserva por cada fecha, todas con el mismo idLoteEspecial', async () => {
      const resultado = await service.crearDirectaLote(dtoBase, laboratorista);

      expect(resultado).toHaveLength(3);
      expect(solicitudRepoTx.save).toHaveBeenCalledTimes(3);

      const lotesGuardados = solicitudRepoTx.save.mock.calls.map(
        ([data]: [any]) => data.idLoteEspecial,
      );
      expect(new Set(lotesGuardados).size).toBe(1);
      expect(lotesGuardados[0]).toEqual(expect.any(String));

      const fechasGuardadas = solicitudRepoTx.save.mock.calls.map(
        ([data]: [any]) => data.fechaPractica,
      );
      expect(fechasGuardadas.sort()).toEqual([...dtoBase.fechas].sort());
    });

    it('usa el mismo tipo/horario/aforo/responsable del dto para TODAS las fechas', async () => {
      await service.crearDirectaLote(dtoBase, laboratorista);

      for (const [data] of solicitudRepoTx.save.mock.calls) {
        expect(data.idTipo).toBe(dtoBase.idTipo);
        expect(data.horaInicio).toBe(dtoBase.horaInicio);
        expect(data.horaFin).toBe(dtoBase.horaFin);
        expect(data.numPersonas).toBe(dtoBase.numPersonas);
        expect(data.responsable).toBe(dtoBase.responsable);
        expect(data.idDocenteEncargado).toBe(dtoBase.idDocenteEncargado);
      }
    });

    it('valida disponibilidad de cada fecha con el mismo horario/tipo/aforo del dto', async () => {
      const spy = jest.spyOn<any, any>(service, 'verificarDisponibilidad');

      await service.crearDirectaLote(dtoBase, laboratorista);

      expect(spy).toHaveBeenCalledTimes(3);
      for (const [args] of spy.mock.calls) {
        expect(args).toMatchObject({
          horaInicio: dtoBase.horaInicio,
          horaFin: dtoBase.horaFin,
          esExclusiva: tipoPracticaLibre.esExclusiva,
          numPersonas: dtoBase.numPersonas,
        });
      }
    });

    it('cada solicitud creada queda APROBADA con firma de docente y laboratorista ya resueltas', async () => {
      await service.crearDirectaLote(dtoBase, laboratorista);

      for (const [data] of solicitudRepoTx.save.mock.calls) {
        expect(data.estado).toBe(EstadoSolicitud.APROBADA);
      }
      // 2 firmas (docente + laboratorista) por cada una de las 3 fechas
      expect(firmaRepoTx.save).toHaveBeenCalledTimes(6);
    });

    it('rechaza si el tipo de reserva no existe', async () => {
      tipoReservaRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.crearDirectaLote(dtoBase, laboratorista),
      ).rejects.toThrow(HttpException);
      expect(solicitudRepoTx.save).not.toHaveBeenCalled();
    });

    it('exige un espacio académico válido, para cualquier tipo de reserva', async () => {
      espacioAcademicoRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.crearDirectaLote(dtoBase, laboratorista),
      ).rejects.toThrow(HttpException);
      expect(solicitudRepoTx.save).not.toHaveBeenCalled();
    });

    it('rechaza si horaFin no es posterior a horaInicio', async () => {
      const dto = { ...dtoBase, horaInicio: '10:00', horaFin: '09:00' };

      await expect(
        service.crearDirectaLote(dto, laboratorista),
      ).rejects.toThrow(HttpException);
      expect(solicitudRepoTx.save).not.toHaveBeenCalled();
    });

    it('todo o nada: si una fecha no tiene disponibilidad, no crea ninguna solicitud', async () => {
      jest
        .spyOn<any, any>(service, 'verificarDisponibilidad')
        .mockImplementation(({ fechaPractica }: { fechaPractica: string }) =>
          Promise.resolve(
            fechaPractica === '2030-10-13'
              ? { disponible: false, motivo: 'Ya hay una reserva aprobada' }
              : { disponible: true },
          ),
        );

      await expect(
        service.crearDirectaLote(dtoBase, laboratorista),
      ).rejects.toMatchObject({
        response: expect.stringContaining('2030-10-13'),
      } as Partial<HttpException>);

      expect(solicitudRepoTx.save).not.toHaveBeenCalled();
    });

    it('rechaza si el docente encargado no está asociado al laboratorio', async () => {
      docenteLaboratorioRepository.exists.mockResolvedValueOnce(false);

      await expect(
        service.crearDirectaLote(dtoBase, laboratorista),
      ).rejects.toThrow(HttpException);
      expect(solicitudRepoTx.save).not.toHaveBeenCalled();
    });

    it('rechaza si el laboratorista creador no está asociado a ese laboratorio', async () => {
      laboratoristaLaboratorioRepository.exists.mockResolvedValueOnce(false);

      await expect(
        service.crearDirectaLote(dtoBase, laboratorista),
      ).rejects.toThrow(HttpException);
      expect(solicitudRepoTx.save).not.toHaveBeenCalled();
    });

    it('rechaza una fecha fuera del periodo académico', async () => {
      const dto = { ...dtoBase, fechas: ['2031-01-05'] };

      await expect(
        service.crearDirectaLote(dto, laboratorista),
      ).rejects.toMatchObject({
        response: expect.stringContaining('2031-01-05'),
      } as Partial<HttpException>);
      expect(solicitudRepoTx.save).not.toHaveBeenCalled();
    });

    it('rechaza si el laboratorio está inactivo', async () => {
      laboratorioRepository.findOne.mockResolvedValueOnce({
        ...laboratorio,
        estado: EstadoLaboratorio.INACTIVO,
      });

      await expect(
        service.crearDirectaLote(dtoBase, laboratorista),
      ).rejects.toThrow(HttpException);
      expect(solicitudRepoTx.save).not.toHaveBeenCalled();
    });

    it('rechaza si el docente encargado, la facultad o el periodo no existen', async () => {
      facultadRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.crearDirectaLote(dtoBase, laboratorista),
      ).rejects.toThrow(HttpException);
      expect(solicitudRepoTx.save).not.toHaveBeenCalled();
    });

    it('acepta un laboratorio en modo "laboratorio_como_servicio" (no solo estándar)', async () => {
      laboratorioRepository.findOne.mockResolvedValueOnce({
        ...laboratorio,
        capacidad: null,
        modoReserva: ModoReservaLaboratorio.LABORATORIO_COMO_SERVICIO,
      });

      const resultado = await service.crearDirectaLote(dtoBase, laboratorista);

      expect(resultado).toHaveLength(3);
    });

    it('rechaza un laboratorio en modo distinto de estándar/como-servicio', async () => {
      laboratorioRepository.findOne.mockResolvedValueOnce({
        ...laboratorio,
        modoReserva: 'otro-modo-inexistente' as ModoReservaLaboratorio,
      });

      await expect(
        service.crearDirectaLote(dtoBase, laboratorista),
      ).rejects.toThrow(HttpException);
      expect(solicitudRepoTx.save).not.toHaveBeenCalled();
    });
  });

  describe('verificarDisponibilidad — reservas exclusivas sin capacidad', () => {
    it('no rechaza por "sin cupo" cuando esExclusiva y no hay capacidad configurada (laboratorio como servicio)', async () => {
      // Sin el spyOn global del beforeEach: acá se prueba la implementación
      // real, no un mock. horarioAcademicoRepository/solicitudRepository ya
      // quedan devolviendo "sin cruces" por los mocks base del beforeEach.
      jest.restoreAllMocks();
      solicitudRepository.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      const resultado = await (service as any).verificarDisponibilidad({
        idLaboratorio: 1,
        capacidadLaboratorio: 0, // null ?? 0 — típico de un laboratorio "como servicio"
        fechaPractica: '2030-10-12',
        horaInicio: '08:00',
        horaFin: '10:00',
        esExclusiva: true,
        numPersonas: 40,
      });

      expect(resultado).toEqual({ disponible: true });
    });
  });

  describe('cancelarLote', () => {
    const idLoteEspecial = 'c2f0c1d2-3333-4a2b-9c3d-000000000003';

    it('cancela todas las solicitudes vivas del lote y devuelve las canceladas', async () => {
      const solicitudesDelLote = [
        { idSolicitud: 1, estado: EstadoSolicitud.APROBADA, idLoteEspecial },
        { idSolicitud: 2, estado: EstadoSolicitud.APROBADA, idLoteEspecial },
        { idSolicitud: 3, estado: EstadoSolicitud.CANCELADA, idLoteEspecial },
      ] as SolicitudReserva[];
      solicitudRepository.find.mockResolvedValue(solicitudesDelLote);

      const cancelarSpy = jest
        .spyOn(service, 'cancelar')
        .mockImplementation((id: number) =>
          Promise.resolve({
            idSolicitud: id,
            estado: EstadoSolicitud.CANCELADA,
          } as SolicitudReserva),
        );

      const resultado = await service.cancelarLote(
        idLoteEspecial,
        laboratorista,
        {},
      );

      // Solo las 2 vivas (APROBADA) se cancelan — la ya CANCELADA se salta.
      expect(cancelarSpy).toHaveBeenCalledTimes(2);
      expect(resultado).toHaveLength(2);
    });

    it('lanza 404 si no existe ninguna solicitud con ese idLoteEspecial', async () => {
      solicitudRepository.find.mockResolvedValue([]);

      await expect(
        service.cancelarLote(idLoteEspecial, laboratorista, {}),
      ).rejects.toThrow(HttpException);
    });

    it('lanza 409 si ninguna solicitud del lote se puede cancelar en su estado actual', async () => {
      solicitudRepository.find.mockResolvedValue([
        { idSolicitud: 1, estado: EstadoSolicitud.CANCELADA, idLoteEspecial },
        { idSolicitud: 2, estado: EstadoSolicitud.RECHAZADA, idLoteEspecial },
      ] as SolicitudReserva[]);

      await expect(
        service.cancelarLote(idLoteEspecial, laboratorista, {}),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('fechasEventoEspecialDelMes', () => {
    it('devuelve solo las fechas dentro del mes pedido con idLoteEspecial', async () => {
      solicitudRepository.find.mockResolvedValue([
        { fechaPractica: '2026-08-12' },
        { fechaPractica: '2026-08-13' },
      ]);

      const fechas = await service.fechasEventoEspecialDelMes(1, 2026, 8);

      expect(fechas).toEqual(['2026-08-12', '2026-08-13']);
      expect(solicitudRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ idLaboratorio: 1 }),
        }),
      );
    });

    it('lanza 404 si el laboratorio no existe', async () => {
      laboratorioRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.fechasEventoEspecialDelMes(999, 2026, 8),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('archivarLote / desarchivarLote / vaciarArchivadasEspeciales', () => {
    const idLoteEspecial = 'd3f0c1d2-4444-4a2b-9c3d-000000000004';
    const admin: AuthenticatedUser = {
      id: 'b1f0c1d2-9999-4a2b-9c3d-000000000009',
      rol: 'admin',
      correo: 'admin@usantoto.edu.co',
      nombre: 'Admin Uno',
    } as AuthenticatedUser;
    const docente: AuthenticatedUser = {
      id: 'b1f0c1d2-8888-4a2b-9c3d-000000000008',
      rol: 'docente',
      correo: 'docente@usantoto.edu.co',
      nombre: 'Docente Uno',
    } as AuthenticatedUser;

    it('archivarLote archiva solo las solicitudes resueltas y no archivadas todavía', async () => {
      solicitudRepository.find.mockResolvedValueOnce([
        {
          idSolicitud: 1,
          estado: EstadoSolicitud.CANCELADA,
          archivada: false,
          idLoteEspecial,
        },
        {
          idSolicitud: 2,
          estado: EstadoSolicitud.APROBADA,
          archivada: false,
          idLoteEspecial,
        },
        {
          idSolicitud: 3,
          estado: EstadoSolicitud.REALIZADA,
          archivada: true,
          idLoteEspecial,
        },
      ] as SolicitudReserva[]);
      solicitudRepository.find.mockResolvedValueOnce([
        {
          idSolicitud: 1,
          estado: EstadoSolicitud.CANCELADA,
          archivada: true,
          idLoteEspecial,
        },
      ] as SolicitudReserva[]);

      await service.archivarLote(idLoteEspecial, laboratorista);

      expect(solicitudRepository.update).toHaveBeenCalledWith(
        { idSolicitud: In([1]) },
        { archivada: true },
      );
    });

    it('archivarLote rechaza si el usuario no es admin ni laboratorista', async () => {
      await expect(
        service.archivarLote(idLoteEspecial, docente),
      ).rejects.toThrow(HttpException);
      expect(solicitudRepository.find).not.toHaveBeenCalled();
    });

    it('archivarLote acepta admin igual que laboratorista', async () => {
      solicitudRepository.find.mockResolvedValue([
        {
          idSolicitud: 1,
          estado: EstadoSolicitud.CANCELADA,
          archivada: false,
          idLoteEspecial,
        },
      ] as SolicitudReserva[]);

      await expect(
        service.archivarLote(idLoteEspecial, admin),
      ).resolves.toBeDefined();
    });

    it('archivarLote lanza 404 si el evento no existe', async () => {
      solicitudRepository.find.mockResolvedValueOnce([]);

      await expect(
        service.archivarLote(idLoteEspecial, laboratorista),
      ).rejects.toThrow(HttpException);
    });

    it('archivarLote lanza 409 si ninguna fecha está en un estado archivable', async () => {
      solicitudRepository.find.mockResolvedValueOnce([
        {
          idSolicitud: 1,
          estado: EstadoSolicitud.APROBADA,
          archivada: false,
          idLoteEspecial,
        },
      ] as SolicitudReserva[]);

      await expect(
        service.archivarLote(idLoteEspecial, laboratorista),
      ).rejects.toThrow(HttpException);
    });

    it('desarchivarLote restaura todas las solicitudes del evento', async () => {
      solicitudRepository.find.mockResolvedValueOnce([
        {
          idSolicitud: 1,
          estado: EstadoSolicitud.CANCELADA,
          archivada: true,
          idLoteEspecial,
        },
      ] as SolicitudReserva[]);
      solicitudRepository.find.mockResolvedValueOnce([
        {
          idSolicitud: 1,
          estado: EstadoSolicitud.CANCELADA,
          archivada: false,
          idLoteEspecial,
        },
      ] as SolicitudReserva[]);

      await service.desarchivarLote(idLoteEspecial, laboratorista);

      expect(solicitudRepository.update).toHaveBeenCalledWith(
        { idLoteEspecial },
        { archivada: false },
      );
    });

    it('desarchivarLote rechaza si el usuario no es admin ni laboratorista', async () => {
      await expect(
        service.desarchivarLote(idLoteEspecial, docente),
      ).rejects.toThrow(HttpException);
    });

    it('vaciarArchivadasEspeciales borra las archivadas de cualquier evento, no solo las propias', async () => {
      solicitudRepository.update.mockResolvedValueOnce({ affected: 3 });

      const eliminadas = await service.vaciarArchivadasEspeciales(admin);

      expect(eliminadas).toBe(3);
      expect(solicitudRepository.update).toHaveBeenCalledWith(
        { idLoteEspecial: Not(IsNull()), archivada: true },
        { eliminada: true },
      );
    });

    it('vaciarArchivadasEspeciales rechaza si el usuario no es admin ni laboratorista', async () => {
      await expect(service.vaciarArchivadasEspeciales(docente)).rejects.toThrow(
        HttpException,
      );
      expect(solicitudRepository.update).not.toHaveBeenCalled();
    });
  });
});
