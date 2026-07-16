import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PeriodosAcademicosService } from './periodos-academicos.service';
import { PeriodoAcademico } from '../entities/periodo-academico.entity';

describe('PeriodosAcademicosService', () => {
  let service: PeriodosAcademicosService;
  let repository: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    preload: jest.Mock;
    softRemove: jest.Mock;
    restore: jest.Mock;
  };

  const periodoBase: PeriodoAcademico = {
    idPeriodo: 1,
    nombre: '2026-2',
    fechaInicio: '2026-07-20',
    fechaFin: '2026-11-20',
    numSemanas: 16,
    fechaCreacion: new Date(),
    fechaActualizacion: new Date(),
    fechaEliminacion: null,
  };

  beforeEach(async () => {
    repository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ ...periodoBase, ...data })),
      preload: jest.fn((data) => Promise.resolve({ ...periodoBase, ...data })),
      softRemove: jest.fn(),
      restore: jest.fn(),
    };

    const dataSourceMock = { getRepository: jest.fn(() => repository) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PeriodosAcademicosService,
        { provide: DataSource, useValue: dataSourceMock },
      ],
    }).compile();

    service = module.get<PeriodosAcademicosService>(PeriodosAcademicosService);
  });

  describe('create', () => {
    it('lanza BAD_REQUEST si fecha_fin <= fecha_inicio', async () => {
      await expect(
        service.create({
          nombre: '2027-1',
          fechaInicio: '2027-01-10',
          fechaFin: '2027-01-01',
        }),
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    });

    it('lanza BAD_REQUEST si fecha_fin es igual a fecha_inicio', async () => {
      await expect(
        service.create({
          nombre: '2027-1',
          fechaInicio: '2027-01-10',
          fechaFin: '2027-01-10',
        }),
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    });

    it('crea con num_semanas por defecto (16) cuando no se envía', async () => {
      repository.findOne.mockResolvedValue(null);

      const periodo = await service.create({
        nombre: '2027-1',
        fechaInicio: '2027-01-10',
        fechaFin: '2027-05-10',
      });

      expect(periodo.numSemanas).toBe(16);
    });

    it('lanza CONFLICT si el nombre ya existe activo', async () => {
      repository.findOne.mockResolvedValue(periodoBase);

      await expect(
        service.create({
          nombre: '2026-2',
          fechaInicio: '2027-01-10',
          fechaFin: '2027-05-10',
        }),
      ).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
    });
  });

  describe('findAll', () => {
    it('ordena por fecha_inicio descendente', async () => {
      repository.find.mockResolvedValue([periodoBase]);

      await service.findAll();

      expect(repository.find).toHaveBeenCalledWith({
        order: { fechaInicio: 'DESC' },
      });
    });
  });
});
