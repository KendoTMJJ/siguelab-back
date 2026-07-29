import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BitacoraService } from './bitacora.service';
import { RegistroUso } from './entities/registro-uso.entity';
import { Laboratorio } from 'src/laboratorios/entities/laboratorio.entity';
import { TipoReserva } from 'src/catalogos/entities/tipo-reserva.entity';
import {
  EstadoSolicitud,
  SolicitudReserva,
} from 'src/solicitudes/entities/solicitud-reserva.entity';
import type { AuthenticatedUser } from 'src/auth/decorators/current-user.decorator';

describe('BitacoraService', () => {
  let service: BitacoraService;

  let registroUsoRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let solicitudRepository: { findOne: jest.Mock };
  let laboratorioRepository: { findOne: jest.Mock };
  let tipoReservaRepository: { findOne: jest.Mock };

  const laboratorista: AuthenticatedUser = {
    id: 'lab-uuid-1',
    nombre: 'Laboratorista Uno',
    correo: 'laboratorista@usantoto.edu.co',
    rol: 'laboratorista',
  };

  const laboratorioBase: Partial<Laboratorio> = { idLaboratorio: 1 };
  const tipoReservaBase: Partial<TipoReserva> = { idTipo: 1 };

  const dtoBase = {
    idLaboratorio: 1,
    idTipo: 1,
    fecha: '2026-08-10',
    horaInicioReal: '08:00',
    horaFinReal: '10:00',
  };

  const queryBuilderMock = {
    orderBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };

  beforeEach(async () => {
    registroUsoRepository = {
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ idRegistro: 1, ...data })),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(() => queryBuilderMock),
    };
    solicitudRepository = { findOne: jest.fn() };
    laboratorioRepository = { findOne: jest.fn() };
    tipoReservaRepository = { findOne: jest.fn() };

    const repos = new Map<unknown, unknown>([
      [RegistroUso, registroUsoRepository],
      [SolicitudReserva, solicitudRepository],
      [Laboratorio, laboratorioRepository],
      [TipoReserva, tipoReservaRepository],
    ]);
    const dataSourceMock = {
      getRepository: jest.fn((entity: unknown) => repos.get(entity)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BitacoraService,
        { provide: DataSource, useValue: dataSourceMock },
      ],
    }).compile();

    service = module.get<BitacoraService>(BitacoraService);
  });

  describe('create', () => {
    it('registra sin id_solicitud usando el id_laboratorista autenticado', async () => {
      laboratorioRepository.findOne.mockResolvedValue(laboratorioBase);
      tipoReservaRepository.findOne.mockResolvedValue(tipoReservaBase);

      const registro = await service.create(dtoBase, laboratorista);

      expect(registro).toMatchObject({
        idLaboratorista: laboratorista.id,
        idSolicitud: null,
      });
      expect(solicitudRepository.findOne).not.toHaveBeenCalled();
    });

    it('lanza NOT_FOUND si el laboratorio no existe', async () => {
      laboratorioRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create(dtoBase, laboratorista),
      ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
    });

    it('lanza NOT_FOUND si el tipo de reserva no existe', async () => {
      laboratorioRepository.findOne.mockResolvedValue(laboratorioBase);
      tipoReservaRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create(dtoBase, laboratorista),
      ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
    });

    it('lanza BAD_REQUEST si la solicitud referenciada no está aprobada', async () => {
      laboratorioRepository.findOne.mockResolvedValue(laboratorioBase);
      tipoReservaRepository.findOne.mockResolvedValue(tipoReservaBase);
      solicitudRepository.findOne.mockResolvedValue({
        idSolicitud: 5,
        idLaboratorio: 1,
        estado: EstadoSolicitud.PENDIENTE_LABORATORISTA,
      });

      await expect(
        service.create({ ...dtoBase, idSolicitud: 5 }, laboratorista),
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    });

    it('lanza BAD_REQUEST si la solicitud es de otro laboratorio', async () => {
      laboratorioRepository.findOne.mockResolvedValue(laboratorioBase);
      tipoReservaRepository.findOne.mockResolvedValue(tipoReservaBase);
      solicitudRepository.findOne.mockResolvedValue({
        idSolicitud: 5,
        idLaboratorio: 999,
        estado: EstadoSolicitud.APROBADA,
      });

      await expect(
        service.create({ ...dtoBase, idSolicitud: 5 }, laboratorista),
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    });

    it('registra con id_solicitud aprobada del mismo laboratorio', async () => {
      laboratorioRepository.findOne.mockResolvedValue(laboratorioBase);
      tipoReservaRepository.findOne.mockResolvedValue(tipoReservaBase);
      solicitudRepository.findOne.mockResolvedValue({
        idSolicitud: 5,
        idLaboratorio: 1,
        estado: EstadoSolicitud.APROBADA,
      });

      const registro = await service.create(
        { ...dtoBase, idSolicitud: 5 },
        laboratorista,
      );

      expect(registro).toMatchObject({ idSolicitud: 5 });
    });

    it('lanza BAD_REQUEST si hora_fin_real <= hora_inicio_real', async () => {
      laboratorioRepository.findOne.mockResolvedValue(laboratorioBase);
      tipoReservaRepository.findOne.mockResolvedValue(tipoReservaBase);

      await expect(
        service.create(
          { ...dtoBase, horaInicioReal: '10:00', horaFinReal: '10:00' },
          laboratorista,
        ),
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    });
  });

  describe('update', () => {
    it('modifica novedad/observaciones', async () => {
      const registroExistente: Partial<RegistroUso> = {
        idRegistro: 1,
        idLaboratorio: 1,
        horaInicioReal: '08:00',
        horaFinReal: '10:00',
        fecha: '2026-08-10',
        novedad: null,
        observaciones: null,
        solicitud: null,
      };
      registroUsoRepository.findOne.mockResolvedValue(registroExistente);

      const actualizado = await service.update(1, {
        novedad: 'Docente ausente',
        observaciones: 'Sin novedad adicional',
      });

      expect(actualizado).toMatchObject({
        idRegistro: 1,
        idLaboratorio: 1,
        novedad: 'Docente ausente',
        observaciones: 'Sin novedad adicional',
      });
    });

    it('también permite corregir laboratorio, tipo, fecha, horas y asistentes', async () => {
      const registroExistente: Partial<RegistroUso> = {
        idRegistro: 1,
        idLaboratorio: 1,
        idTipo: 1,
        horaInicioReal: '08:00',
        horaFinReal: '10:00',
        fecha: '2026-08-10',
        numAsistentes: 5,
        solicitud: null,
      };
      registroUsoRepository.findOne.mockResolvedValue(registroExistente);
      laboratorioRepository.findOne.mockResolvedValue({ idLaboratorio: 2 });
      tipoReservaRepository.findOne.mockResolvedValue({ idTipo: 3 });

      const actualizado = await service.update(1, {
        idLaboratorio: 2,
        idTipo: 3,
        fecha: '2026-08-11',
        horaInicioReal: '09:00',
        horaFinReal: '11:00',
        numAsistentes: 12,
      });

      expect(actualizado).toMatchObject({
        idLaboratorio: 2,
        idTipo: 3,
        fecha: '2026-08-11',
        horaInicioReal: '09:00',
        horaFinReal: '11:00',
        numAsistentes: 12,
      });
    });

    it('lanza NOT_FOUND si el nuevo laboratorio no existe', async () => {
      registroUsoRepository.findOne.mockResolvedValue({
        idRegistro: 1,
        horaInicioReal: '08:00',
        horaFinReal: '10:00',
        solicitud: null,
      });
      laboratorioRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update(1, { idLaboratorio: 999 }),
      ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
    });

    it('lanza BAD_REQUEST si el nuevo laboratorio no corresponde a la solicitud enlazada', async () => {
      registroUsoRepository.findOne.mockResolvedValue({
        idRegistro: 1,
        horaInicioReal: '08:00',
        horaFinReal: '10:00',
        solicitud: { idSolicitud: 5, idLaboratorio: 1 },
      });
      laboratorioRepository.findOne.mockResolvedValue({ idLaboratorio: 2 });

      await expect(
        service.update(1, { idLaboratorio: 2 }),
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    });

    it('lanza BAD_REQUEST si la hora de fin resultante no es posterior a la de inicio', async () => {
      registroUsoRepository.findOne.mockResolvedValue({
        idRegistro: 1,
        horaInicioReal: '08:00',
        horaFinReal: '10:00',
        solicitud: null,
      });

      await expect(
        service.update(1, { horaInicioReal: '11:00' }),
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    });

    it('lanza NOT_FOUND si el registro no existe', async () => {
      registroUsoRepository.findOne.mockResolvedValue(null);

      await expect(service.update(999, { novedad: 'x' })).rejects.toMatchObject(
        { status: HttpStatus.NOT_FOUND },
      );
    });
  });

  describe('findOne', () => {
    it('devuelve el registro con sus relaciones', async () => {
      const registro = { idRegistro: 1 };
      registroUsoRepository.findOne.mockResolvedValue(registro);

      await expect(service.findOne(1)).resolves.toBe(registro);
      expect(registroUsoRepository.findOne).toHaveBeenCalledWith({
        where: { idRegistro: 1 },
        relations: {
          laboratorio: true,
          tipoReserva: true,
          laboratorista: true,
          solicitud: true,
        },
      });
    });

    it('lanza NOT_FOUND si no existe', async () => {
      registroUsoRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });
  });

  describe('findAll', () => {
    it('aplica los filtros de laboratorio y rango de fechas', async () => {
      await service.findAll({
        idLaboratorio: 1,
        fechaDesde: '2026-08-01',
        fechaHasta: '2026-08-31',
      });

      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'registro.id_laboratorio = :idLaboratorio',
        { idLaboratorio: 1 },
      );
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'registro.fecha >= :fechaDesde',
        { fechaDesde: '2026-08-01' },
      );
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'registro.fecha <= :fechaHasta',
        { fechaHasta: '2026-08-31' },
      );
    });

    it('siempre resuelve laboratorio, tipoReserva, laboratorista y solicitud con join', async () => {
      await service.findAll({});

      expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith(
        'registro.laboratorio',
        'laboratorio',
      );
      expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith(
        'registro.tipoReserva',
        'tipoReserva',
      );
      expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith(
        'registro.laboratorista',
        'laboratorista',
      );
      expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith(
        'registro.solicitud',
        'solicitud',
      );
    });

    it('filtra por periodo reusando el alias de la solicitud ya unida', async () => {
      await service.findAll({ idPeriodo: 3 });

      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'solicitud.id_periodo = :idPeriodo',
        { idPeriodo: 3 },
      );
    });

    it('sin page/pageSize no aplica skip/take y devuelve pageSize = total', async () => {
      queryBuilderMock.getManyAndCount.mockResolvedValueOnce([
        [{ idRegistro: 1 }],
        1,
      ]);

      const resultado = await service.findAll({});

      expect(queryBuilderMock.skip).not.toHaveBeenCalled();
      expect(queryBuilderMock.take).not.toHaveBeenCalled();
      expect(resultado).toEqual({
        items: [{ idRegistro: 1 }],
        total: 1,
        page: 1,
        pageSize: 1,
      });
    });

    it('con page/pageSize aplica skip/take y los devuelve en la respuesta', async () => {
      queryBuilderMock.getManyAndCount.mockResolvedValueOnce([[], 42]);

      const resultado = await service.findAll({ page: 2, pageSize: 20 });

      expect(queryBuilderMock.skip).toHaveBeenCalledWith(20);
      expect(queryBuilderMock.take).toHaveBeenCalledWith(20);
      expect(resultado).toEqual({
        items: [],
        total: 42,
        page: 2,
        pageSize: 20,
      });
    });
  });
});
