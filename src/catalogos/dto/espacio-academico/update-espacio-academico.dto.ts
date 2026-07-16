import { PartialType } from '@nestjs/mapped-types';
import { CreateEspacioAcademicoDto } from './create-espacio-academico.dto';

export class UpdateEspacioAcademicoDto extends PartialType(
  CreateEspacioAcademicoDto,
) {}
