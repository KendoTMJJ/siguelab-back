import { IsOptional, IsString, IsNotEmpty, MaxLength } from 'class-validator';

/**
 * El frontend trae cargo/facultad de Microsoft Graph (jobTitle/department)
 * con un token de scope User.Read propio — este backend nunca llama a
 * Graph, solo persiste lo que ya validó y trajo el cliente.
 */
export class ActualizarDirectorioDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  cargo?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  facultad?: string;
}
