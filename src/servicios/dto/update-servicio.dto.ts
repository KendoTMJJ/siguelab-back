import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateServicioDto } from './create-servicio.dto';

/** idLaboratorio no se edita — un servicio no cambia de laboratorio, se
 * borra y se crea de nuevo si hace falta (mismo criterio que otros catálogos). */
export class UpdateServicioDto extends PartialType(
  OmitType(CreateServicioDto, ['idLaboratorio'] as const),
) {}
