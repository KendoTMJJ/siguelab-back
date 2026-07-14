import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegistroDto {
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @IsEmail()
  correo!: string;

  @IsString()
  @MinLength(8)
  contrasena!: string;
}
