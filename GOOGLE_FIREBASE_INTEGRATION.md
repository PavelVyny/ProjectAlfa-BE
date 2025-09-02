# Google + Firebase Integration Guide

## Что изменилось

Теперь все пользователи, входящие через Google-аккаунт, автоматически попадают в Firebase и получают `firebaseUid`.

## Архитектура

```
Google OAuth → GoogleAuthService → AuthService → FirebaseService + PrismaService
     ↓              ↓                ↓              ↓           ↓
Google Token → Verify Token → Create/Update User → Firebase + PostgreSQL
```

## Новые возможности

### 1. **Автоматическое создание в Firebase**

- Google пользователи создаются в Firebase без пароля
- Email автоматически помечается как верифицированный
- Получают `displayName` и `photoURL` от Google

### 2. **Синхронизация данных**

- При каждом входе через Google обновляется информация
- Автоматически создается Firebase UID если его нет
- Привязка между PostgreSQL и Firebase через `firebaseUid`

### 3. **Обратная совместимость**

- Существующие Google пользователи получат Firebase UID при следующем входе
- Система работает даже если Firebase недоступен

## API Endpoints

### POST /auth/google

```json
{
	"credential": "google_jwt_token"
}
```

**Ответ:**

```json
{
	"access_token": "jwt_token",
	"user": {
		"id": "user_id",
		"email": "user@example.com",
		"firstName": "John",
		"lastName": "Doe",
		"avatar": "https://..."
	}
}
```

## Тестирование

### 1. **Запуск скрипта проверки**

```bash
node check-google-users.js
```

Этот скрипт покажет:

- Общее количество пользователей
- Количество Google пользователей
- Количество пользователей с Firebase UID
- Детальную информацию о каждом пользователе
- Анализ связей между системами

### 2. **Проверка через API**

```bash
# Тест Google аутентификации
curl -X POST http://localhost:3001/auth/google \
  -H "Content-Type: application/json" \
  -d '{"credential": "your_google_jwt_token"}'
```

### 3. **Проверка в Firebase Console**

1. Откройте [Firebase Console](https://console.firebase.google.com/)
2. Выберите ваш проект
3. Перейдите в Authentication → Users
4. Убедитесь, что Google пользователи появились

## Логи

Система логирует все операции:

```
✅ Google пользователь создан в Firebase с UID: abc123
✅ Google пользователь создан в PostgreSQL с ID: def456
✅ Существующий Google пользователь создан в Firebase с UID: ghi789
```

## Обработка ошибок

### Firebase недоступен

- Пользователь создается в PostgreSQL без `firebaseUid`
- При следующем входе система попытается создать Firebase UID снова
- Логируется ошибка, но система продолжает работать

### Дублирование email

- Система проверяет существование email в обеих системах
- Предотвращает создание дублирующих записей
- Обновляет существующую информацию

## Переменные окружения

Убедитесь, что установлены:

```bash
# Google OAuth
GOOGLE_CLIENT_ID="your_google_client_id"

# Firebase Admin SDK
FIREBASE_PROJECT_ID="your_project_id"
FIREBASE_PRIVATE_KEY="your_private_key"
FIREBASE_CLIENT_EMAIL="your_client_email"

# JWT
JWT_SECRET="your_jwt_secret"

# Database
DATABASE_URL="your_postgresql_url"
```

## Развертывание

1. **Обновите код** с новыми изменениями
2. **Проверьте переменные окружения**
3. **Запустите миграции** (если нужно): `npx prisma db push`
4. **Перезапустите сервер**
5. **Протестируйте** Google аутентификацию

## Мониторинг

### Метрики для отслеживания:

- Количество Google пользователей
- Количество пользователей с Firebase UID
- Успешность создания в Firebase
- Время отклика Google OAuth

### Алерты:

- Ошибки создания в Firebase
- Проблемы с Google OAuth
- Высокое время отклика

## Troubleshooting

### Google пользователь не создается в Firebase

1. Проверьте Firebase credentials
2. Убедитесь, что Firebase API включен
3. Проверьте логи на ошибки

### Пользователь не получает firebaseUid

1. Проверьте связь с Firebase
2. Убедитесь, что email уникален
3. Проверьте права доступа к Firebase

### Ошибки аутентификации

1. Проверьте GOOGLE_CLIENT_ID
2. Убедитесь, что Google OAuth настроен
3. Проверьте CORS настройки

## Безопасность

- Google токены верифицируются на сервере
- Firebase UID генерируется безопасно
- Email верификация через Google
- JWT токены для сессий

## Производительность

- Асинхронные операции с Firebase
- Кэширование Google токенов
- Оптимизированные запросы к базе данных
- Graceful fallback при ошибках Firebase
