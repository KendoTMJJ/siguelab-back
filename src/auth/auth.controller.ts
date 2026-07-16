import {
  Body,
  Controller,
  Post,
  Res,
  HttpCode,
  HttpStatus,
  Get,
  Param,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegistroDto } from './dto/registro.dto';
import { OlvidePasswordDto } from './dto/olvide-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ReenviarVerificacionDto } from './dto/reenviar-verificacion.dto';
import { minutes, SkipThrottle, Throttle } from '@nestjs/throttler';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthenticatedUser } from './decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('registro')
  @HttpCode(HttpStatus.CREATED)
  registro(@Body() registroDto: RegistroDto) {
    return this.authService.registro(registroDto);
  }

  @Public()
  @Get('verificar/:token')
  verificar(@Param('token') token: string) {
    return this.authService.verificarCorreo(token);
  }

  @Public()
  @Throttle({ login: { limit: 5, ttl: minutes(60) } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { access_token, usuario } = await this.authService.login(loginDto);

    console.log('access_token:', access_token);

    res.cookie('access_token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000,
    });

    return { usuario };
  }

  @Public()
  @Throttle({ 'olvide-password': { limit: 5, ttl: minutes(60) } })
  @Post('olvide-password')
  @HttpCode(HttpStatus.OK)
  olvidePassword(@Body() dto: OlvidePasswordDto) {
    return this.authService.olvidePassword(dto);
  }

  @Public()
  @Throttle({ 'reenviar-verificacion': { limit: 5, ttl: minutes(60) } })
  @Post('reenviar-verificacion')
  @HttpCode(HttpStatus.OK)
  reenviarVerificacion(@Body() dto: ReenviarVerificacionDto) {
    return this.authService.reenviarVerificacion(dto);
  }

  @Public()
  @Post('reset-password/:token')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Param('token') token: string, @Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(token, dto);
  }

  @SkipThrottle({ login: true })
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token');
    return { message: 'Sesión cerrada' };
  }

  @SkipThrottle({ login: true })
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }
}
