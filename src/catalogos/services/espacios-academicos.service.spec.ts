import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EspaciosAcademicosService } from './espacios-academicos.service';
import { EspacioAcademico } from '../entities/espacio-academico.entity';

describe('EspaciosAcademicosService', () => {
  let service: EspaciosAcademicosService;
  let repository: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    preload: jest.Mock;
    softRemove: jest.Mock;
    restore: jest.Mock;
  };

  const espacioBase: EspacioAcademico = {
    idEspacio: 1,
    codigo: 'ELEC-204',
    nombre: 'Electrónica Digital II',
    fechaCreacion: new Date(),
    fechaActualizacion: new Date(),
    fechaEliminacion: null,
  };

  beforeEach(async () => {
    repository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ ...espacioBase, ...data })),
      preload: jest.fn((data) => Promise.resolve({ ...espacioBase, ...data })),
      softRemove: jest.fn(),
      restore: jest.fn(),
    };

    const dataSourceMock = { getRepository: jest.fn(() => repository) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EspaciosAcademicosService,
        { provide: DataSource, useValue: dataSourceMock },
      ],
    }).compile();

    service = module.get<EspaciosAcademicosService>(EspaciosAcademicosService);
  });

  describe('findAll', () => {
    it('sin `buscar` lista todo, ordenado por nombre', async () => {
      repository.find.mockResolvedValue([espacioBase]);

      await service.findAll();

      expect(repository.find).toHaveBeenCalledWith({
        order: { nombre: 'ASC' },
      });
    });

    it('con `buscar` filtra por nombre O código (case-insensitive)', async () => {
      repository.find.mockResolvedValue([espacioBase]);

      const resultado = await service.findAll('electr');

      expect(repository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.arrayContaining([
            expect.objectContaining({ nombre: expect.anything() }),
            expect.objectContaining({ codigo: expect.anything() }),
          ]),
        }),
      );
      expect(resultado).toHaveLength(1);
    });

    it('no expone el campo interno codigoActivo', async () => {
      repository.find.mockResolvedValue([
        { ...espacioBase, codigoActivo: 'ELEC-204' },
      ]);

      const [espacio] = await service.findAll();

      expect(espacio).not.toHaveProperty('codigoActivo');
    });
  });

  describe('create', () => {
    it('lanza CONFLICT si el código ya está activo en otro espacio', async () => {
      repository.findOne.mockResolvedValue(espacioBase);

      await expect(
        service.create({ nombre: 'Otro nombre', codigo: 'ELEC-204' }),
      ).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
    });

    it('permite crear sin código (nullable)', async () => {
      const espacio = await service.create({ nombre: 'Sin código' });

      expect(espacio.nombre).toBe('Sin código');
    });
  });
});
