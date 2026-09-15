import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificacionesService } from './notificaciones.service';

/**
 * Worker del "outbox" de notificaciones — corre en el mismo proceso Node
 * (no hace falta Redis/RabbitMQ: con una sola instancia del backend, la
 * propia tabla `notificacion` ya cumple el rol de cola). Cada 30 segundos
 * busca las que quedaron en estado `pendiente` (insertadas por
 * NotificacionesService.notificar/notificarGenerico, que ya no esperan al
 * SMTP) y las manda.
 */
@Injectable()
export class NotificacionesScheduler {
  private readonly logger = new Logger(NotificacionesScheduler.name);
  private procesando = false;

  constructor(private readonly notificacionesService: NotificacionesService) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async procesarPendientes(): Promise<void> {
    // Evita que dos corridas se solapen si un lote tarda más de 30s en
    // mandarse (SMTP lento) — sin esto, enviarPendientes() podría arrancar
    // de nuevo sobre las mismas filas antes de que la corrida anterior
    // llegara a marcarlas como enviadas.
    if (this.procesando) {
      return;
    }
    this.procesando = true;
    try {
      await this.notificacionesService.enviarPendientes();
    } catch (error) {
      this.logger.error(
        'Error inesperado procesando notificaciones pendientes',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.procesando = false;
    }
  }
}
