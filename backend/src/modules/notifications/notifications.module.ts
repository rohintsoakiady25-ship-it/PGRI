import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { NotificationsService } from './notifications.service';

/** E-mails automatiques aux demandeurs, envoyés par Microsoft Graph depuis la boîte de la plateforme. */
@Module({
  providers: [MailService, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
