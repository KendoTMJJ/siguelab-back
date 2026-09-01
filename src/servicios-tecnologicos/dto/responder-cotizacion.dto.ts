import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsString, ValidateIf } from 'class-validator';

export class ResponderCotizacionDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  aprobar!: boolean;

  @ApiPropertyOptional({ example: 'El costo supera el presupuesto disponible' })
  @ValidateIf((dto: ResponderCotizacionDto) => !dto.aprobar)
  @IsString()
  @IsNotEmpty()
  motivoRechazo?: string;
}
