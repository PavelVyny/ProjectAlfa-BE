import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { EventsModule } from './events/events.module';

@Module({
  imports: [AuthModule, EventsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
