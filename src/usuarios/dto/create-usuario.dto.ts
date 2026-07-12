import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateUsuarioDto {
  @IsInt()
  idRol!: number;

  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @IsEmail()
  correo!: string;

  @IsString()
  @MinLength(8)
  contrasena!: string;
}
