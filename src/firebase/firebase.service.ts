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
      console.log(
        `✅ Google пользователь создан в Firebase без пароля: ${userRecord.uid}`,
      );
      return userRecord.uid;
    } catch (error) {
      console.error(
        '❌ Ошибка создания Google пользователя в Firebase:',
        error,
      );
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

  async getUserByUid(uid: string) {
    try {
      const userRecord = await this.firebaseApp.auth().getUser(uid);
      return userRecord;
    } catch (error) {
      console.error(
        '❌ Ошибка получения пользователя по UID из Firebase:',
        error,
      );
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(
        `Не удалось получить пользователя по UID из Firebase: ${errorMessage}`,
      );
    }
  }

  async sendPasswordResetEmail(email: string): Promise<void> {
    try {
      // Firebase Admin SDK не имеет прямого метода для отправки письма сброса пароля
      // Это делается через Firebase Auth REST API
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${process.env.FIREBASE_WEB_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requestType: 'PASSWORD_RESET',
            email: email,
          }),
        },
      );

      const data = (await response.json()) as {
        error?: { message?: string };
      };

      if (!response.ok) {
        throw new Error(
          data.error?.message || 'Failed to send password reset email',
        );
      }

      console.log(`✅ Письмо сброса пароля отправлено на: ${email}`);
    } catch (error) {
      console.error('❌ Ошибка отправки письма сброса пароля:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(
        `Не удалось отправить письмо сброса пароля: ${errorMessage}`,
      );
    }
  }

  async updateUserPassword(uid: string, newPassword: string): Promise<void> {
    try {
      await this.firebaseApp.auth().updateUser(uid, {
        password: newPassword,
      });

      console.log(`✅ Пароль обновлен в Firebase для UID: ${uid}`);
    } catch (error) {
      console.error('❌ Ошибка обновления пароля в Firebase:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Не удалось обновить пароль в Firebase: ${errorMessage}`);
    }
  }

  async verifyPassword(email: string, password: string): Promise<boolean> {
    try {
      // Используем Firebase REST API для проверки пароля
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_WEB_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email,
            password: password,
            returnSecureToken: true,
          }),
        },
      );

      if (response.ok) {
        console.log(`✅ Пароль проверен в Firebase для: ${email}`);
        return true;
      } else {
        console.log(`❌ Неверный пароль в Firebase для: ${email}`);
        return false;
      }
    } catch (error) {
      console.error('❌ Ошибка проверки пароля в Firebase:', error);
      return false;
    }
  }

  async verifyPasswordAndGetUser(
    email: string,
    password: string,
  ): Promise<{ uid: string; email: string; emailVerified: boolean } | null> {
    try {
      // Используем Firebase REST API для проверки пароля и получения данных пользователя
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_WEB_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email,
            password: password,
            returnSecureToken: true,
          }),
        },
      );

      const data = (await response.json()) as {
        localId?: string;
        email?: string;
        emailVerified?: boolean;
      };

      if (response.ok && data.localId && data.email) {
        console.log(`✅ Пароль проверен в Firebase для: ${email}`);
        return {
          uid: data.localId,
          email: data.email,
          emailVerified: data.emailVerified || false,
        };
      } else {
        console.log(`❌ Неверный пароль в Firebase для: ${email}`);
        return null;
      }
    } catch (error) {
      console.error('❌ Ошибка проверки пароля в Firebase:', error);
      return null;
    }
  }
}
