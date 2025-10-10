# ✅ Чек-лист обновления схемы: firstName/lastName → nickname

## 🔧 **Что нужно сделать:**

### 1. **Сгенерировать новый Prisma Client**
```bash
cd ProjectAlfa-BE
npx prisma generate
```

### 2. **Создать и применить миграцию**
```bash
# Для разработки
npx prisma migrate dev --name "replace_firstname_lastname_with_nickname"

# Для продакшна
npx prisma migrate deploy
```

### 3. **Перезапустить сервер бэкенда**
```bash
npm run start:dev
```

## 📋 **Что уже обновлено:**

### ✅ **Prisma Schema** (`prisma/schema.prisma`)
- Удалены поля `firstName` и `lastName`
- Добавлено поле `nickname String?`

### ✅ **DTO** (`src/auth/dto/auth.dto.ts`)
- `RegisterDto` теперь принимает `nickname?: string`
- `AuthResponseDto` возвращает `nickname?: string`

### ✅ **AuthService** (`src/auth/auth.service.ts`)
- Обновлена логика регистрации для работы с `nickname`
- Обновлена Google Auth логика:
  - Для новых Google пользователей: `nickname = firstName + lastName`
  - Для существующих: сохраняется текущий `nickname`
- Все возвращаемые объекты user обновлены

## 🧪 **Тестирование после обновления:**

### 1. **Регистрация нового пользователя**
```json
POST /auth/register
{
  "email": "test@example.com",
  "password": "password123",
  "nickname": "TestUser"
}
```

### 2. **Google авторизация**
- Войти через Google
- Проверить, что `nickname` создается из имени и фамилии Google

### 3. **Обновление профиля**
- Проверить, что фронтенд корректно отображает `nickname`

## ⚠️ **Важные моменты:**

1. **Данные существующих пользователей**: При миграции данные в `firstName`/`lastName` будут потеряны
2. **Google пользователи**: Автоматически получат `nickname` из имени и фамилии Google
3. **Обычные пользователи**: Нужно будет ввести `nickname` при следующем обновлении профиля

## 🔄 **Миграция данных (опционально):**

Если нужно сохранить данные существующих пользователей:

```sql
-- Добавить поле nickname
ALTER TABLE "User" ADD COLUMN "nickname" TEXT;

-- Перенести данные
UPDATE "User" 
SET "nickname" = CONCAT("firstName", ' ', "lastName")
WHERE "firstName" IS NOT NULL AND "lastName" IS NOT NULL;

UPDATE "User" 
SET "nickname" = COALESCE("firstName", "lastName")
WHERE "firstName" IS NOT NULL OR "lastName" IS NOT NULL;

-- Удалить старые поля (после проверки)
ALTER TABLE "User" DROP COLUMN "firstName";
ALTER TABLE "User" DROP COLUMN "lastName";
```

## ✅ **Проверка готовности:**

- [ ] Prisma Client сгенерирован (`npx prisma generate`)
- [ ] Миграция применена (`npx prisma migrate dev`)
- [ ] Сервер перезапущен
- [ ] Тестирование регистрации прошло успешно
- [ ] Тестирование Google Auth прошло успешно
- [ ] Фронтенд корректно отображает данные

## 🚨 **Если что-то пошло не так:**

### Откат изменений:
```bash
# Откатить миграцию
npx prisma migrate resolve --rolled-back "replace_firstname_lastname_with_nickname"

# Вернуть старую схему в prisma/schema.prisma
# Перегенерировать клиент
npx prisma generate
```

### Проверка статуса:
```bash
# Посмотреть статус миграций
npx prisma migrate status

# Посмотреть историю миграций
npx prisma migrate history
```
