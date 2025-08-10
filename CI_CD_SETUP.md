# Настройка CI/CD для ProjectAlfa-BE

## Что создано

1. **GitHub Actions workflow** (`.github/workflows/deploy.yml`) - автоматический деплой на Google Cloud без Docker

## Настройка GitHub Secrets

В настройках вашего GitHub репозитория добавьте следующие секреты:

### GCP_SA_KEY

Содержимое вашего service account ключа (весь JSON файл):

```json
{
	"type": "service_account",
	"project_id": "YOUR_PROJECT_ID",
	"private_key_id": "YOUR_PRIVATE_KEY_ID",
	"private_key": "-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_CONTENT\n-----END PRIVATE KEY-----\n",
	"client_email": "YOUR_SERVICE_ACCOUNT_EMAIL",
	"client_id": "YOUR_CLIENT_ID",
	"auth_uri": "https://accounts.google.com/o/oauth2/auth",
	"token_uri": "https://oauth2.googleapis.com/token",
	"auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
	"client_x509_cert_url": "YOUR_CLIENT_X509_CERT_URL",
	"universe_domain": "googleapis.com"
}
```

## Как это работает

### При push в main или develop ветки:

1. Запускаются тесты и линтинг
2. Если тесты прошли успешно, приложение собирается
3. Google Cloud автоматически собирает и деплоит приложение из исходного кода

### При создании Pull Request:

1. Запускаются только тесты и линтинг
2. Деплой не происходит

## Настройка Google Cloud

Убедитесь, что у вас включены следующие API:

- Cloud Run API
- Cloud Build API

## Проверка деплоя

После успешного деплоя ваше приложение будет доступно по адресу:

```
https://project-alfa-backend-[hash]-[region].run.app
```

## Мониторинг

Все действия можно отслеживать в:

1. GitHub Actions вкладке вашего репозитория
2. Google Cloud Console в разделе Cloud Run
3. Google Cloud Console в разделе Cloud Build

## Преимущества деплоя без Docker

- Проще настройка
- Меньше файлов конфигурации
- Google Cloud автоматически оптимизирует сборку
- Быстрее деплой
