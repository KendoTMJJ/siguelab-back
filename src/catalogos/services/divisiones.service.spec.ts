import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DivisionesService } from './divisiones.service';
import { Division } from '../entities/division.entity';
import { Facultad } from '../entities/facultad.entity';

describe('DivisionesService', () => {
  let service: DivisionesService;
  let divisionRepository: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    preload: jest.Mock;
    softRemove: jest.Mock;
  };
  let facultadRepository: { find: jest.Mock; exists: jest.Mock };

  const divisionBase: Division = {
    idDivision: 1,
    nombre: 'Arquitectura e Ingenierías',
    facultades: [],
    fechaCreacion: new Date(),
    fechaActualizacion: new Date(),
    fechaEliminacion: null,
  };

  beforeEach(async () => {
    divisionRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ ...divisionBase, ...data })),
      preload: jest.fn((data) => Promise.resolve({ ...divisionBase, ...data })),
      softRemove: jest.fn(),
    };
    facultadRepository = { find: jest.fn(), exists: jest.fn() };

    const dataSourceMock = {
      getRepository: jest.fn((entity) => {
        if (entity === Facultad) return facultadRepository;
        return divisionRepository;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DivisionesService,
        { provide: DataSource, useValue: dataSourceMock },
      ],
    }).compile();

    service = module.get<DivisionesService>(DivisionesService);
  });

  describe('create', () => {
    it('crea una división con nombre nuevo', async () => {
      divisionRepository.findOne.mockResolvedValue(null);

      const division = await service.create({ nombre: 'Nueva División' });

      expect(division.idDivision).toBe(1);
    });

    it('lanza CONFLICT si el nombre ya existe activo', async () => {
      divisionRepository.findOne.mockResolvedValue(divisionBase);

      await expect(
        service.create({ nombre: 'Arquitectura e Ingenierías' }),
      ).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
    });

    it('permite crear con el nombre de una división ya eliminada (findOne no la trae)', async () => {
      // @DeleteDateColumn excluye soft-deleted por defecto en find/findOne.
      divisionRepository.findOne.mockResolvedValue(null);

      const division = await service.create({
        nombre: 'Arquitectura e Ingenierías',
      });

      expect(division.idDivision).toBe(1);
    });
  });

  describe('remove', () => {
    it('elimina (soft delete) una división sin facultades activas', async () => {
      divisionRepository.findOne.mockResolvedValue(divisionBase);
      facultadRepository.exists.mockResolvedValue(false);

      await service.remove(1);

      expect(divisionRepository.softRemove).toHaveBeenCalledWith(divisionBase);
    });

    it('lanza CONFLICT si tiene facultades activas', async () => {
      divisionRepository.findOne.mockResolvedValue(divisionBase);
      facultadRepository.exists.mockResolvedValue(true);

      await expect(service.remove(1)).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
      });
    });
  });

  describe('findOne', () => {
    it('lanza NOT_FOUND si la división no existe', async () => {
      divisionRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });

    it('retorna la división si existe', async () => {
      divisionRepository.findOne.mockResolvedValue(divisionBase);

      await expect(service.findOne(1)).resolves.toEqual(divisionBase);
    });
  });
});
