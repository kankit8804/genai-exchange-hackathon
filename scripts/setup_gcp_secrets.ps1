# Setup script for Secret Manager, IAM, Cloud Run secret mapping and build
# Run this locally in PowerShell where gcloud is authenticated (gcloud auth login)
# Adjust variables below if needed.

param()

$PROJECT_ID = "orbit-ai-472708"
$SERVICE_NAME = "orbit-web"
$REGION = "us-central1"
$envFile = ".\.env.local"
$tempJson = ".\firebase-service-account.json"

Write-Host "Project: $PROJECT_ID"
Write-Host "Service: $SERVICE_NAME"; Write-Host "Region: $REGION"

# 1) Extract FIREBASE_SERVICE_ACCOUNT from .env.local if present and write to temp JSON
if (Test-Path $envFile) {
  Write-Host "Extracting FIREBASE_SERVICE_ACCOUNT from $envFile"
  $line = Get-Content $envFile | Where-Object { $_ -match '^FIREBASE_SERVICE_ACCOUNT=' } | Select-Object -First 1
  if ($line) {
    $val = $line.Split('=',2)[1]
    $val = $val.Trim('"').Trim("'")
    $val = $val -replace '\\n', "`n"
    Set-Content -Path $tempJson -Value $val -NoNewline
    Write-Host "Wrote service account JSON to $tempJson (inspect before proceeding)."
  } else {
    Write-Host "No FIREBASE_SERVICE_ACCOUNT line found in $envFile. If you have a service-account.json file, set its path in this script and skip extraction."
  }
} else {
  Write-Host "$envFile not found. If you have a service-account.json file, set its path in this script and skip extraction."
}

# 2) Create secrets and add values
function Create-SecretFromValue([string]$name, [string]$value) {
  Write-Host "Creating secret $name"
  # create secret if it doesn't exist
  $exists = gcloud secrets list --project=$PROJECT_ID --filter="name:$name" --format="value(name)"
  if (-not $exists) {
    gcloud secrets create $name --project $PROJECT_ID --replication-policy="automatic" --quiet
  } else {
    Write-Host "Secret $name already exists, adding a new version."
  }
  # Sanitize value to remove stray CR/LF and surrounding whitespace
  $clean = ($value -replace "`r", "")
  $clean = $clean.Trim()
  $tmp = Join-Path $PWD "$name.txt"
  Set-Content -Path $tmp -Value $clean -NoNewline -Encoding utf8
  gcloud secrets versions add $name --project $PROJECT_ID --data-file=$tmp --quiet
  Remove-Item $tmp -ErrorAction SilentlyContinue
}

function Create-SecretFromFile([string]$name, [string]$filePath) {
  Write-Host "Creating secret $name from file $filePath"
  $exists = gcloud secrets list --project=$PROJECT_ID --filter="name:$name" --format="value(name)"
  if (-not $exists) {
    gcloud secrets create $name --project $PROJECT_ID --replication-policy="automatic" --quiet
  } else {
    Write-Host "Secret $name already exists, adding a new version."
  }
  gcloud secrets versions add $name --project $PROJECT_ID --data-file=$filePath --quiet
}

# Create admin JSON secret from file if file exists
if (Test-Path $tempJson) {
  Create-SecretFromFile -name "FIREBASE_SERVICE_ACCOUNT" -filePath $tempJson
} else {
  Write-Host "Service account JSON file not found at $tempJson. Please provide the path to the JSON and add it as a secret manually or update this script."
}

# Create NEXT_PUBLIC_* secrets (values from user)
Create-SecretFromValue "NEXT_PUBLIC_FIREBASE_API_KEY" "AIzaSyAXijr9tz2aTq19lOjV4M5X-EhbJGQYPpQ"
Create-SecretFromValue "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN" "orbit-ai-3d3a5.firebaseapp.com"
Create-SecretFromValue "NEXT_PUBLIC_FIREBASE_PROJECT_ID" "orbit-ai-3d3a5"
Create-SecretFromValue "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET" "orbit-ai-3d3a5.firebasestorage.app"
Create-SecretFromValue "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID" "591514097275"
Create-SecretFromValue "NEXT_PUBLIC_FIREBASE_APP_ID" "1:591514097275:web:30d179ad2c8587d1ec34de"
Create-SecretFromValue "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID" "G-E8K0TTSMHW"
Create-SecretFromValue "NEXT_PUBLIC_API_BASE_URL" "https://orbit-api-938180057345.us-central1.run.app"

Write-Host "Created/updated secrets in Secret Manager."

# 3) Grant Cloud Build SA access to secrets (so it can read NEXT_PUBLIC_* during build)
$PROJECT_NUMBER = gcloud projects describe $PROJECT_ID --format="value(projectNumber)"
$cloudBuildSA = "$PROJECT_NUMBER@cloudbuild.gserviceaccount.com"
Write-Host "Granting secretAccessor to Cloud Build SA: $cloudBuildSA"
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$cloudBuildSA" --role="roles/secretmanager.secretAccessor" --quiet

# 4) Grant Cloud Run service account access to FIREBASE_SERVICE_ACCOUNT secret
# Get Cloud Run service account for the service
$sa = gcloud run services describe $SERVICE_NAME --region $REGION --project $PROJECT_ID --format="value(spec.template.spec.serviceAccountName)"
if (-not $sa) {
  Write-Host "Could not determine Cloud Run service account for $SERVICE_NAME. Please ensure the service exists or set the service account manually."
} else {
  Write-Host "Cloud Run service account for $SERVICE_NAME is: $sa"
  gcloud secrets add-iam-policy-binding FIREBASE_SERVICE_ACCOUNT --project $PROJECT_ID --member="serviceAccount:$sa" --role="roles/secretmanager.secretAccessor" --quiet
}

# 5) Map secrets into Cloud Run env vars (so admin.ts can read FIREBASE_SERVICE_ACCOUNT env var)
# This updates the service and creates new revision.
if ($sa) {
  Write-Host "Updating Cloud Run service to map FIREBASE_SERVICE_ACCOUNT secret into env var FIREBASE_SERVICE_ACCOUNT"
  gcloud run services update $SERVICE_NAME --project=$PROJECT_ID --region=$REGION --update-secrets "FIREBASE_SERVICE_ACCOUNT=FIREBASE_SERVICE_ACCOUNT:latest" --quiet
  Write-Host "(Optionally map other runtime secrets similarly using --update-secrets)")
}

# 6) Trigger Cloud Build using cloudbuild.yaml present in repo root (will use secrets)
Write-Host "Submitting Cloud Build using cloudbuild.yaml..."
gcloud builds submit --config=cloudbuild.yaml --project=$PROJECT_ID .

Write-Host "Done. Inspect Cloud Build logs in the Cloud Console and Cloud Run logs after deployment."

# Optional cleanup of temp JSON
if (Test-Path $tempJson) {
  Remove-Item $tempJson -Force
  Write-Host "Removed temp file $tempJson"
}
