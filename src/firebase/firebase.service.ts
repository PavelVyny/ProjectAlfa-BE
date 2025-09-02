import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private firebaseApp: admin.app.App;

  async onModuleInit() {
    await new Promise((resolve) => setTimeout(resolve, 0)); // Добавляем await
    this.firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
    });
  }

  async createUser(
    email: string,
    password: string,
    displayName?: string,
  ): Promise<string> {
    try {
      const userRecord = await this.firebaseApp.auth().createUser({
        email,
        password,
        displayName,
        emailVerified: false,
      });
      console.log(`✅ Пользователь создан в Firebase: ${userRecord.uid}`);
      return userRecord.uid;
    } catch (error) {
      console.error('❌ Ошибка создания пользователя в Firebase:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(
        `Не удалось создать пользователя в Firebase: ${errorMessage}`,
      );
    }
  }

  async createUserWithoutPassword(
    email: string,
    displayName?: string,
    photoURL?: string,
  ): Promise<string> {
    try {
      const userRecord = await this.firebaseApp.auth().createUser({
        email,
        displayName,
        photoURL,
        emailVerified: true, // Google email уже верифицирован
        disabled: false,
      });
      console.log(`✅ Google пользователь создан в Firebase без пароля: ${userRecord.uid}`);
      return userRecord.uid;
    } catch (error) {
      console.error('❌ Ошибка создания Google пользователя в Firebase:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(
        `Не удалось создать Google пользователя в Firebase: ${errorMessage}`,
      );
    }
  }

  async getUser(uid: string) {
    try {
      const userRecord = await this.firebaseApp.auth().getUser(uid);
      return userRecord;
    } catch (error) {
      console.error('❌ Ошибка получения пользователя из Firebase:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(
        `Не удалось получить пользователя из Firebase: ${errorMessage}`,
      );
    }
  }

  async deleteUser(uid: string) {
    try {
      await this.firebaseApp.auth().deleteUser(uid);
      console.log(`✅ Пользователь удален из Firebase: ${uid}`);
    } catch (error) {
      console.error('❌ Ошибка удаления пользователя из Firebase:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(
        `Не удалось удалить пользователя из Firebase: ${errorMessage}`,
      );
    }
  }

  async userExists(email: string): Promise<boolean> {
    try {
      await this.firebaseApp.auth().getUserByEmail(email);
      return true;
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'auth/user-not-found'
      ) {
        return false;
      }
      throw error;
    }
  }

  async getUserByEmail(email: string) {
    try {
      const userRecord = await this.firebaseApp.auth().getUserByEmail(email);
      return userRecord;
    } catch (error) {
      console.error(
        '❌ Ошибка получения пользователя по email из Firebase:',
        error,
      );
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(
        `Не удалось получить пользователя по email из Firebase: ${errorMessage}`,
      );
    }
  }
}
