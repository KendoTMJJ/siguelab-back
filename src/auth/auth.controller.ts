import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthenticatedUser } from './decorators/current-user.decorator';

/**
 * Sin /login ni /registro: Entra ID es la única fuente de identidad y el
 * login lo hace el frontend con MSAL. Este backend solo valida el token
 * (ver JwtStrategy) y expone el perfil ya resuelto.
 */
@ApiTags('auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  @Get('me')
  @ApiOperation({
    summary:
      'Perfil del usuario autenticado (resuelto desde el token de Entra)',
  })
  @ApiResponse({ status: 200, description: 'Usuario autenticado' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }
}
