# GitHub Actions Deployment Setup

This repository uses GitHub Actions to automatically deploy to Google Cloud Run when changes are pushed to the `main` branch.

## Architecture

- **orbit-web** (Frontend) - Next.js application at `web/`
- **orbit-api** (Backend) - FastAPI application at `api/`

Each service deploys independently when changes are detected in its directory.

## Prerequisites

### 1. Set up Workload Identity Federation (Recommended)

This allows GitHub Actions to authenticate with Google Cloud without storing service account keys.

```bash
# Set variables
export PROJECT_ID="orbit-ai-472708"
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
export WORKLOAD_IDENTITY_POOL="github-actions-pool"
export WORKLOAD_IDENTITY_PROVIDER="github-provider"
export SERVICE_ACCOUNT="github-actions-sa"
export REPO="git4sudo/genai-exchange-hackathon"

# Enable required APIs
gcloud services enable iamcredentials.googleapis.com \
  cloudresourcemanager.googleapis.com \
  sts.googleapis.com \
  --project=$PROJECT_ID

# Create service account
gcloud iam service-accounts create $SERVICE_ACCOUNT \
  --display-name="GitHub Actions Service Account" \
  --project=$PROJECT_ID

# Grant necessary permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Create Workload Identity Pool
gcloud iam workload-identity-pools create $WORKLOAD_IDENTITY_POOL \
  --location="global" \
  --display-name="GitHub Actions Pool" \
  --project=$PROJECT_ID

# Create Workload Identity Provider
gcloud iam workload-identity-pools providers create-oidc $WORKLOAD_IDENTITY_PROVIDER \
  --location="global" \
  --workload-identity-pool=$WORKLOAD_IDENTITY_POOL \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='${REPO}'" \
  --project=$PROJECT_ID

# Allow GitHub Actions to impersonate the service account
gcloud iam service-accounts add-iam-policy-binding \
  "${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WORKLOAD_IDENTITY_POOL}/attribute.repository/${REPO}" \
  --project=$PROJECT_ID

# Get the Workload Identity Provider resource name
echo "Workload Identity Provider:"
gcloud iam workload-identity-pools providers describe $WORKLOAD_IDENTITY_PROVIDER \
  --location="global" \
  --workload-identity-pool=$WORKLOAD_IDENTITY_POOL \
  --project=$PROJECT_ID \
  --format="value(name)"
```

### 2. Add GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions → New repository secret

Add these secrets:

1. **WIF_PROVIDER** - The Workload Identity Provider path (output from the command above)
   ```
   projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-actions-pool/providers/github-provider
   ```

2. **WIF_SERVICE_ACCOUNT** - The service account email
   ```
   github-actions-sa@orbit-ai-472708.iam.gserviceaccount.com
   ```

### 3. Ensure GCP Secrets Exist

Make sure these secrets exist in Google Cloud Secret Manager:

**For API:**
- `GEMINI_API_KEY`
- `FIREBASE_SERVICE_ACCOUNT_KEY`

**For Web:**
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`
- `NEXT_PUBLIC_API_BASE_URL`

## How It Works

### Automatic Deployments

1. **API Changes** - When you push changes to `api/**`, the `deploy-api.yml` workflow runs
2. **Web Changes** - When you push changes to `web/**`, the `deploy-web.yml` workflow runs
3. Both workflows can also be triggered manually from the Actions tab

### Manual Deployment

Go to **Actions** tab → Select the workflow → Click "Run workflow"

## Workflow Features

✅ **Smart triggering** - Only deploys when relevant files change
✅ **Secure authentication** - Uses Workload Identity Federation (no keys stored)
✅ **Environment variables** - Automatically pulls from Secret Manager
✅ **Image tagging** - Tags with commit SHA and 'latest'
✅ **Auto-scaling** - Configured with sensible defaults
✅ **Public access** - Sets `--allow-unauthenticated` for both services

## Testing Locally

### API
```bash
cd api
docker build -t orbit-api .
docker run -p 8080:8080 orbit-api
```

### Web
```bash
cd web
docker build -t orbit-web .
docker run -p 8080:8080 orbit-web
```

## Monitoring

View deployment status:
- **GitHub**: Actions tab shows build/deploy progress
- **GCP Console**: Cloud Run section shows service status
- **Logs**: `gcloud run logs read orbit-api --region=us-central1`

## Cost Optimization

The workflows include:
- Memory limit: 1Gi
- CPU: 1
- Timeout: 300s
- Max instances: 10

Adjust these in the workflow files based on your needs.

## Troubleshooting

### Build fails
- Check that Dockerfiles are valid
- Ensure all dependencies are in requirements.txt / package.json

### Deployment fails
- Verify IAM permissions for the service account
- Check Secret Manager has all required secrets
- Ensure Cloud Run API is enabled

### Authentication errors
- Verify WIF_PROVIDER and WIF_SERVICE_ACCOUNT secrets in GitHub
- Check service account has necessary roles
