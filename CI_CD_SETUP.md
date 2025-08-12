# CI/CD Setup for ProjectAlfa-BE

## What's Created

1. **GitHub Actions workflow** (`.github/workflows/deploy.yml`) - automatic deployment to Google Cloud without Docker
2. **Configuration file** (`.github/workflows/config.env`) - centralized environment variables configuration

## Configuration

### Environment Variables

All environment variables are stored in `.github/workflows/config.env` file:

```bash
# Google Cloud Configuration
PROJECT_ID=alpha-develop
REGION=us-central1
SERVICE_NAME=project-alfa-backend

# Application Configuration
NODE_VERSION=20
PORT=3001
MEMORY=512Mi
CPU=1
MAX_INSTANCES=10
MIN_INSTANCES=0

# Build Configuration
BUILD_CACHE=npm
```

### GitHub Repository Variables

To use these variables in your workflow, add them as repository variables in GitHub:

1. Go to your repository Settings → Secrets and variables → Actions
2. Add the following variables in the "Variables" tab:
   - `PROJECT_ID`: Your Google Cloud project ID
   - `REGION`: Your preferred Google Cloud region
   - `SERVICE_NAME`: Your service name
   - `NODE_VERSION`: Node.js version (default: 20)
   - `PORT`: Application port (default: 3001)
   - `MEMORY`: Memory allocation (default: 512Mi)
   - `CPU`: CPU allocation (default: 1)
   - `MAX_INSTANCES`: Maximum instances (default: 10)
   - `MIN_INSTANCES`: Minimum instances (default: 0)
   - `BUILD_CACHE`: Build cache type (default: npm)

## GitHub Secrets Configuration

In your GitHub repository settings, add the following secrets:

### GCP_SA_KEY

Content of your service account key (entire JSON file):

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

## How It Works

### When pushing to main or develop branches:

1. Tests and linting are run
2. If tests pass successfully, the application is built
3. Google Cloud automatically builds and deploys the application from source code

### When creating a Pull Request:

1. Only tests and linting are run
2. Deployment does not occur

## Google Cloud Configuration

Make sure you have the following APIs enabled:

- Cloud Run API
- Cloud Build API

## Deployment Verification

After successful deployment, your application will be available at:

```
https://project-alfa-backend-[hash]-[region].run.app
```

## Monitoring

All actions can be tracked in:

1. GitHub Actions tab of your repository
2. Google Cloud Console in the Cloud Run section
3. Google Cloud Console in the Cloud Build section

## Benefits of Deployment without Docker

- Simpler configuration
- Fewer configuration files
- Google Cloud automatically optimizes the build
- Faster deployment

## Benefits of Centralized Configuration

- Easy to modify deployment parameters
- Version control for configuration
- Reusable across different environments
- Clear separation of concerns
