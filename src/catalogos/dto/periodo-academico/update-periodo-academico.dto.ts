import { PartialType } from '@nestjs/mapped-types';
import { CreatePeriodoAcademicoDto } from './create-periodo-academico.dto';

export class UpdatePeriodoAcademicoDto extends PartialType(
  CreatePeriodoAcademicoDto,
) {}
