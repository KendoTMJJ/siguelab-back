import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { v4 as uuid } from 'uuid';

/** Raíz de almacenamiento local de archivos subidos — fuera de /dist y /src,
 * montada como volumen Docker persistente. Ver .gitignore. */
export const UPLOADS_ROOT = join(process.cwd(), 'uploads');

const MIME_TYPES_FICHA_TECNICA = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

/** Config de Multer para la ficha técnica de un Equipo (datasheet/manual del
 * fabricante): PDF o imagen, hasta 10MB. Genera un nombre único en disco
 * (uuid + extensión original) para no pisar archivos ni exponer el nombre
 * real hasta que se autoriza la descarga. */
export function multerFichaTecnicaConfig(): MulterOptions {
  const destino = join(UPLOADS_ROOT, 'equipos-ficha-tecnica');
  if (!existsSync(destino)) {
    mkdirSync(destino, { recursive: true });
  }

  return {
    storage: diskStorage({
      destination: destino,
      filename: (_req, file, callback) => {
        callback(null, `${uuid()}${extname(file.originalname)}`);
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, callback) => {
      if (!MIME_TYPES_FICHA_TECNICA.includes(file.mimetype)) {
        callback(
          new BadRequestException(
            'La ficha técnica debe ser PDF, JPG, PNG o WEBP',
          ),
          false,
        );
        return;
      }
      callback(null, true);
    },
  };
}

const EXTENSIONES_ARCHIVO_SERVICIO = [
  '.stl',
  '.step',
  '.stp',
  '.dxf',
  '.obj',
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.zip',
];

/** Config de Multer para el archivo de una solicitud de servicio tecnológico.
 * Los formatos 3D (STL/STEP/DXF/OBJ) no tienen un MIME type confiable — la
 * mayoría de navegadores los manda como application/octet-stream genérico —
 * así que se valida por extensión, no por mimetype como en fichaTecnica. Si
 * son varios archivos, la regla de negocio es que el solicitante los agrupe
 * en un .zip antes de subir (un solo archivo por servicio, siempre). */
export function multerArchivoServicioConfig(): MulterOptions {
  const destino = join(UPLOADS_ROOT, 'servicios-tecnologicos');
  if (!existsSync(destino)) {
    mkdirSync(destino, { recursive: true });
  }

  return {
    storage: diskStorage({
      destination: destino,
      filename: (_req, file, callback) => {
        callback(null, `${uuid()}${extname(file.originalname)}`);
      },
    }),
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_req, file, callback) => {
      const extension = extname(file.originalname).toLowerCase();
      if (!EXTENSIONES_ARCHIVO_SERVICIO.includes(extension)) {
        callback(
          new BadRequestException(
            `Extensión "${extension}" no permitida (STL, STEP, DXF, OBJ, PDF, JPG, PNG, WEBP o ZIP)`,
          ),
          false,
        );
        return;
      }
      callback(null, true);
    },
  };
}
