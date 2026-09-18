import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SolicitudesService } from './solicitudes.service';

/**
 * Corre una vez al día (mismo patrón que NotificacionesScheduler, ver ese
 * archivo): avisa a los laboratoristas de cada laboratorio que una reserva
 * suya (aprobada, o cancelada después de estarlo — nunca libera el
 * horario antes de su fecha, ver SolicitudesService.cancelar) ya venció sin
 * bitácora registrada.
 */
@Injectable()
export class SolicitudesScheduler {
  private readonly logger = new Logger(SolicitudesScheduler.name);
  private procesando = false;

  constructor(private readonly solicitudesService: SolicitudesService) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async avisarBitacorasPendientes(): Promise<void> {
    if (this.procesando) {
      return;
    }
    this.procesando = true;
    try {
      await this.solicitudesService.avisarBitacorasPendientes();
    } catch (error) {
      this.logger.error(
        'Error inesperado avisando bitácoras pendientes',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.procesando = false;
    }
  }
}
