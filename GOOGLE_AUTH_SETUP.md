# Google OAuth Setup Guide

## Изменения в бэкенде

### 1. Обновлена схема базы данных

- Добавлено поле `googleId` для хранения Google ID пользователя
- Добавлено поле `avatar` для хранения URL аватара от Google
- Поле `password` сделано опциональным для Google пользователей
- **НОВОЕ**: Google пользователи теперь тоже получают `firebaseUid` и попадают в Firebase

### 2. Новые файлы

- `src/auth/google-auth.service.ts` - сервис для верификации Google токенов
- `GOOGLE_AUTH_SETUP.md` - это руководство

### 3. Обновленные файлы

- `src/auth/auth.service.ts` - добавлен метод `googleAuth()` с интеграцией Firebase
- `src/auth/auth.controller.ts` - добавлен эндпоинт `POST /auth/google`
- `src/auth/auth.module.ts` - добавлен `GoogleAuthService`
- `src/auth/dto/auth.dto.ts` - добавлен `GoogleAuthDto`
- `prisma/schema.prisma` - обновлена модель User
- `src/firebase/firebase.service.ts` - добавлен метод `createUserWithoutPassword()`

### 4. Переменные окружения

Добавлена в `.env`:

```
GOOGLE_CLIENT_ID="480977786594-of15aub7mfv02ggv2fdsiutfiu4p8v81.apps.googleusercontent.com"
```

## Новый API эндпоинт

### POST /auth/google

Авторизация через Google OAuth.

**Запрос:**

```json
{
	"credential": "google_jwt_token_here"
}
```

**Ответ:**

```json
{
	"access_token": "jwt_token_here",
	"user": {
		"id": "user_id",
		"email": "user@example.com",
		"firstName": "John",
		"lastName": "Doe",
		"avatar": "https://lh3.googleusercontent.com/..."
	}
}
```

## Логика работы

### 1. **Новый пользователь через Google:**

- Создается запись в Firebase без пароля (только email)
- Создается запись в PostgreSQL с `googleId` и `firebaseUid`
- Возвращается JWT токен

### 2. **Существующий пользователь через Google:**

- Если у пользователя нет `firebaseUid`, создается в Firebase
- Обновляется информация (имя, аватар, `googleId`, `firebaseUid`)
- Возвращается JWT токен

### 3. **Существующий пользователь через обычную авторизацию:**

- Если у пользователя нет пароля (Google пользователь), возвращается ошибка
- Если есть пароль, проверяется как обычно

## Firebase интеграция

**ВАЖНО**: Теперь все Google пользователи автоматически попадают в Firebase:

- Создаются без пароля (только email)
- Email помечается как верифицированный
- Получают `displayName` и `photoURL` от Google
- Привязываются к PostgreSQL через `firebaseUid`

## Развертывание

1. Убедитесь, что переменная `GOOGLE_CLIENT_ID` добавлена в production окружение
2. Запустите миграцию базы данных: `npx prisma db push`
3. Перезапустите сервер

## Тестирование

Фронтенд уже настроен для отправки запросов на `POST /auth/google` с Google JWT токеном.

## Обратная совместимость

Существующие Google пользователи без `firebaseUid` автоматически получат его при следующем входе через Google.
