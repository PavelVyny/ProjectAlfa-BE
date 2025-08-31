import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private firebaseApp: admin.app.App;

  async onModuleInit() {
    // Инициализируем Firebase Admin SDK
    this.firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
    });
  }

  /**
   * Создает пользователя в Firebase Authentication
   * @param email - Email пользователя
   * @param password - Пароль пользователя
   * @param displayName - Отображаемое имя (firstName + lastName)
   * @returns Firebase UID пользователя
   */
  async createUser(email: string, password: string, displayName?: string): Promise<string> {
    try {
      const userRecord = await this.firebaseApp.auth().createUser({
        email,
        password,
        displayName,
        emailVerified: false, // Email не подтвержден по умолчанию
      });

      console.log(`✅ Пользователь создан в Firebase: ${userRecord.uid}`);
      return userRecord.uid;
    } catch (error) {
      console.error('❌ Ошибка создания пользователя в Firebase:', error);
      throw new Error(`Не удалось создать пользователя в Firebase: ${error.message}`);
    }
  }

  /**
   * Получает пользователя по Firebase UID
   * @param uid - Firebase UID
   * @returns Данные пользователя из Firebase
   */
  async getUser(uid: string) {
    try {
      const userRecord = await this.firebaseApp.auth().getUser(uid);
      return userRecord;
    } catch (error) {
      console.error('❌ Ошибка получения пользователя из Firebase:', error);
      throw new Error(`Не удалось получить пользователя из Firebase: ${error.message}`);
    }
  }

  /**
   * Удаляет пользователя из Firebase
   * @param uid - Firebase UID
   */
  async deleteUser(uid: string) {
    try {
      await this.firebaseApp.auth().deleteUser(uid);
      console.log(`✅ Пользователь удален из Firebase: ${uid}`);
    } catch (error) {
      console.error('❌ Ошибка удаления пользователя из Firebase:', error);
      throw new Error(`Не удалось удалить пользователя из Firebase: ${error.message}`);
    }
  }

  /**
   * Проверяет, существует ли пользователь с данным email
   * @param email - Email для проверки
   * @returns true если пользователь существует, false если нет
   */
  async userExists(email: string): Promise<boolean> {
    try {
      await this.firebaseApp.auth().getUserByEmail(email);
      return true;
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Получает пользователя по email
   * @param email - Email пользователя
   * @returns Данные пользователя из Firebase
   */
  async getUserByEmail(email: string) {
    try {
      const userRecord = await this.firebaseApp.auth().getUserByEmail(email);
      return userRecord;
    } catch (error) {
      console.error('❌ Ошибка получения пользователя по email из Firebase:', error);
      throw new Error(`Не удалось получить пользователя по email из Firebase: ${error.message}`);
    }
  }
}
