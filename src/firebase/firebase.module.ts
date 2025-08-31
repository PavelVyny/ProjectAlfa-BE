import { Module } from '@nestjs/common';
import { FirebaseService } from './firebase.service';

@Module({
  providers: [FirebaseService],
  exports: [FirebaseService], // Экспортируем сервис для использования в других модулях
})
export class FirebaseModule {}
