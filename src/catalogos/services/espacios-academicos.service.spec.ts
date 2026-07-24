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

    it('con `buscar` filtra por nombre (case-insensitive)', async () => {
      repository.find.mockResolvedValue([espacioBase]);

      const resultado = await service.findAll('electr');

      expect(repository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ nombre: expect.anything() }),
        }),
      );
      expect(resultado).toHaveLength(1);
    });

    it('no expone el campo interno nombreActivo', async () => {
      repository.find.mockResolvedValue([
        { ...espacioBase, nombreActivo: 'Electrónica Digital II' },
      ]);

      const [espacio] = await service.findAll();

      expect(espacio).not.toHaveProperty('nombreActivo');
    });
  });

  describe('create', () => {
    it('lanza CONFLICT si el nombre ya está activo en otro espacio', async () => {
      repository.findOne.mockResolvedValue(espacioBase);

      await expect(
        service.create({ nombre: 'Electrónica Digital II' }),
      ).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
    });

    it('crea un espacio con nombre único', async () => {
      repository.findOne.mockResolvedValue(null);

      const espacio = await service.create({ nombre: 'Química' });

      expect(espacio.nombre).toBe('Química');
    });
  });
});
