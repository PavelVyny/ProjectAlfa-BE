# Миграция базы данных: firstName/lastName → nickname

## Описание изменений

Изменена схема пользователя с полей `firstName` и `lastName` на единое поле `nickname`.

## Шаги миграции

### 1. Создание миграции Prisma

Выполните следующую команду в корне проекта бэкенда:

```bash
cd ProjectAlfa-BE
npx prisma migrate dev --name "replace_firstname_lastname_with_nickname"
```

### 2. Если миграция не создается автоматически

Если Prisma не может автоматически создать миграцию, выполните:

```bash
npx prisma migrate reset
npx prisma migrate dev --name "initial_with_nickname"
```

### 3. Применение миграции в продакшне

```bash
npx prisma migrate deploy
```

### 4. Генерация нового Prisma Client

```bash
npx prisma generate
```

## Что изменилось в схеме

### Было:
```prisma
model User {
  firstName String?
  lastName  String?
  // ... другие поля
}
```

### Стало:
```prisma
model User {
  nickname  String?  // Никнейм пользователя
  // ... другие поля
}
```

## Влияние на существующие данные

⚠️ **ВНИМАНИЕ**: При применении этой миграции данные в полях `firstName` и `lastName` будут потеряны, если не выполнить предварительную миграцию данных.

### Рекомендуемый подход для сохранения данных:

1. **Создайте скрипт миграции данных** (опционально):
```sql
-- Добавить поле nickname
ALTER TABLE "User" ADD COLUMN "nickname" TEXT;

-- Перенести данные из firstName и lastName в nickname
UPDATE "User" 
SET "nickname" = CONCAT("firstName", ' ', "lastName")
WHERE "firstName" IS NOT NULL AND "lastName" IS NOT NULL;

UPDATE "User" 
SET "nickname" = "firstName"
WHERE "firstName" IS NOT NULL AND "lastName" IS NULL;

UPDATE "User" 
SET "nickname" = "lastName"
WHERE "firstName" IS NULL AND "lastName" IS NOT NULL;

-- Удалить старые поля
ALTER TABLE "User" DROP COLUMN "firstName";
ALTER TABLE "User" DROP COLUMN "lastName";
```

2. **Или создайте кастомную миграцию**:
```bash
# Создать пустую миграцию
npx prisma migrate dev --create-only --name "custom_nickname_migration"

# Отредактировать созданный файл миграции
# Добавить SQL для переноса данных
```

## Проверка после миграции

1. **Проверьте структуру таблицы**:
```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'User';
```

2. **Проверьте данные**:
```sql
SELECT id, email, nickname, avatar, "googleId" 
FROM "User" 
LIMIT 5;
```

3. **Протестируйте API**:
   - Регистрация нового пользователя
   - Вход через Google
   - Обновление профиля

## Откат изменений (если нужно)

Если нужно откатить изменения:

```bash
# Откатить последнюю миграцию
npx prisma migrate resolve --rolled-back "replace_firstname_lastname_with_nickname"

# Или сбросить все миграции (ОСТОРОЖНО!)
npx prisma migrate reset
```

## Обновление фронтенда

Убедитесь, что фронтенд обновлен для работы с полем `nickname`:

- ✅ Типы TypeScript обновлены
- ✅ Компоненты используют `nickname` вместо `firstName`/`lastName`
- ✅ API вызовы обновлены
