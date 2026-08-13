import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UsuariosService } from './usuarios.service';
import { EstadoUsuario } from './entities/usuario.entity';
import { Rol } from 'src/roles/entities/rol.entity';

describe('UsuariosService', () => {
  let service: UsuariosService;
  let usuarioRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    softRemove: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let rolRepository: { findOne: jest.Mock };

  const UUID_ROL = 'b1f0c1d2-1111-4a2b-9c3d-000000000001';
  const UUID_USUARIO = 'b1f0c1d2-2222-4a2b-9c3d-000000000002';
  const OID_ENTRA = 'entra-oid-0001';

  const rolEstudiante: Rol = { idRol: UUID_ROL, nombre: 'estudiante' };

  beforeEach(async () => {
    usuarioRepository = {
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) =>
        Promise.resolve({ ...data, idUsuario: UUID_USUARIO }),
      ),
      softRemove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    rolRepository = { findOne: jest.fn() };

    const dataSourceMock = {
      getRepository: jest.fn((entity) => {
        if (entity === Rol) return rolRepository;
        return usuarioRepository;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsuariosService,
        { provide: DataSource, useValue: dataSourceMock },
      ],
    }).compile();

    service = module.get<UsuariosService>(UsuariosService);
  });

  describe('findOrCreateByOid', () => {
    const perfil = {
      oid: OID_ENTRA,
      correo: 'estudiante@usantoto.edu.co',
      nombre: 'Estudiante Entra',
    };

    it('retorna el usuario existente si el oid ya está vinculado', async () => {
      const usuarioExistente = {
        idUsuario: UUID_USUARIO,
        oid: OID_ENTRA,
        rol: rolEstudiante,
      };
      usuarioRepository.findOne.mockResolvedValueOnce(usuarioExistente);

      const usuario = await service.findOrCreateByOid(perfil);

      expect(usuario).toBe(usuarioExistente);
      expect(usuarioRepository.save).not.toHaveBeenCalled();
    });

    it('vincula el oid a una fila pre-creada por correo (ej. el admin sembrado)', async () => {
      const filaPreCreada = {
        idUsuario: UUID_USUARIO,
        oid: null,
        correo: perfil.correo,
        rol: rolEstudiante,
      };
      usuarioRepository.findOne
        .mockResolvedValueOnce(null) // por oid: no existe aún
        .mockResolvedValueOnce(filaPreCreada); // por correo: sí existe

      const usuario = await service.findOrCreateByOid(perfil);

      expect(usuarioRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ oid: OID_ENTRA }),
      );
      expect(usuario.oid).toBe(OID_ENTRA);
    });

    it('crea un usuario nuevo con el rol por defecto si no existe por oid ni por correo', async () => {
      usuarioRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      rolRepository.findOne.mockResolvedValue(rolEstudiante);

      const usuario = await service.findOrCreateByOid(perfil);

      expect(usuario.rol).toEqual(rolEstudiante);
      expect(usuario.oid).toBe(OID_ENTRA);
      expect(usuario.correo).toBe(perfil.correo);
    });

    it('lanza error si no existe el rol por defecto', async () => {
      usuarioRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      rolRepository.findOne.mockResolvedValue(null);

      await expect(service.findOrCreateByOid(perfil)).rejects.toMatchObject({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    });
  });

  describe('findOne', () => {
    it('lanza NOT_FOUND si el usuario no existe', async () => {
      usuarioRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('id-que-no-existe')).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });

    it('retorna el usuario con su rol si existe', async () => {
      const usuario = { idUsuario: UUID_USUARIO, estado: EstadoUsuario.ACTIVO };
      usuarioRepository.findOne.mockResolvedValue(usuario);

      await expect(service.findOne(UUID_USUARIO)).resolves.toEqual(usuario);
    });
  });

  describe('update', () => {
    const OTRO_UUID_ROL = 'b1f0c1d2-1111-4a2b-9c3d-000000000099';

    it('cambia solo el rol, sin tocar nombre ni correo', async () => {
      const usuarioExistente = {
        idUsuario: UUID_USUARIO,
        nombre: 'Nombre Institucional',
        correo: 'original@usantoto.edu.co',
        estado: EstadoUsuario.ACTIVO,
        rol: rolEstudiante,
      };
      usuarioRepository.findOne.mockResolvedValue(usuarioExistente);

      const actualizado = await service.update(UUID_USUARIO, {
        idRol: OTRO_UUID_ROL,
      });

      expect(actualizado).toMatchObject({
        nombre: 'Nombre Institucional',
        correo: 'original@usantoto.edu.co',
        rol: { idRol: OTRO_UUID_ROL },
      });
    });

    it('lanza NOT_FOUND si el usuario no existe', async () => {
      usuarioRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('id-que-no-existe', { idRol: OTRO_UUID_ROL }),
      ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
    });
  });
});
