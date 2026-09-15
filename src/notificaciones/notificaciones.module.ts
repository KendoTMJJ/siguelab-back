import { Module } from '@nestjs/common';
import { MailModule } from 'src/mail/mail.module';
import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesService } from './notificaciones.service';
import { NotificacionesScheduler } from './notificaciones.scheduler';

@Module({
  imports: [MailModule],
  controllers: [NotificacionesController],
  providers: [NotificacionesService, NotificacionesScheduler],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
