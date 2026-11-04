# Render deployment readiness

The Render Blueprint defines three services:

- `ricehub-backend`: Django/Daphne web service; runs production checks and
  collects static files during build. `/health/` checks database connectivity.
- `ricehub-celery-worker`: Celery worker and Beat scheduler, using
  `backend/Dockerfile.worker`.
- `ricehub-frontend`: Vite static site built from `frontend/`, with SPA route
  rewrites. Its build-time `VITE_API_URL` and `VITE_WS_URL` point to the
  existing `ricehub-umfd.onrender.com` backend.

Production uses OCI Autonomous Database (ATP) for relational data and OCI
Object Storage through its S3-compatible API for uploaded media. Backend
static files use WhiteNoise.

## Render Dashboard setup

Apply the Blueprint in Render, then open each service's **Environment** page and
confirm the following settings. Values marked as secrets must be entered as
protected environment values; never commit them to this repository.

| Service | Variable | Required value |
| --- | --- | --- |
| `ricehub-backend` and `ricehub-celery-worker` | `DJANGO_SECRET_KEY` | A new, unique, high-entropy Django secret; keep identical on both services |
| Both backend services | `DB_USER`, `DB_PASSWORD`, `DB_SERVICE_NAME` | ATP database user (defaults to `admin`), password, and the wallet `tnsnames.ora` service alias such as `ricehub_low` |
| Both backend services | `WALLET_DIR` | `/etc/secrets` on Render; store the extracted ATP wallet files there as secret files |
| Both backend services | `WALLET_PASSWORD` | Optional protected variable if the downloaded wallet requires a password |
| Both backend services | `OCI_OBJECT_STORAGE_NAMESPACE`, `OCI_OBJECT_STORAGE_BUCKET`, `OCI_OBJECT_STORAGE_REGION`, `OCI_OBJECT_STORAGE_ACCESS_KEY`, `OCI_OBJECT_STORAGE_SECRET_KEY` | OCI Object Storage namespace, bucket, region, and S3-compatibility customer secret key pair |
| Both backend services | `REDIS_URL` | The Render Redis connection string reachable by both services |
| `ricehub-backend` | `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL` | Valid SMTP sender credentials and address |
| `ricehub-celery-worker` | `FIREBASE_CREDENTIALS_JSON` | Firebase service-account JSON, only if push delivery is enabled |
| `ricehub-backend` | `FRONTEND_URL` | `https://ricehub-frontend.onrender.com` |
| `ricehub-frontend` | `VITE_API_URL` | `https://ricehub-umfd.onrender.com/api` |
| `ricehub-frontend` | `VITE_WS_URL` | `wss://ricehub-umfd.onrender.com/ws` |
| `ricehub-backend` | `SMS_PROVIDER`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | Optional Twilio credentials for phone verification OTP delivery; leave unset until configured |
| `ricehub-backend` | `PAYMENT_INSTRUCTIONS` | Optional safe transfer instructions shown in-app; automatic billing is disabled and payment requests require staff review |

The Blueprint supplies the non-secret frontend URLs and frontend origin. Verify
that the `ricehub-umfd.onrender.com` hostname is attached to the backend service
that serves this deployment; if the actual backend hostname differs, update
both frontend build variables and the backend `FRONTEND_URL`, CORS, and CSRF
trusted origins together, then redeploy.

The frontend URLs are Vite build-time variables: changing them requires a new
static-site build/deploy. Do not put credentials in `VITE_*` variables because
they become public in the browser bundle.

### Oracle ATP wallet and media storage

1. Download the client credentials wallet for the ATP database and add its
   extracted files to each Render backend service as secret files under
   `/etc/secrets`, keeping their original names (including `tnsnames.ora`,
   `sqlnet.ora`, `cwallet.sso`, and the wallet files supplied by Oracle).
   Do not commit the wallet or put it in a public static directory. The wallet
   directory is ignored by Git for local development.
2. Set `DB_SERVICE_NAME` to the exact `_low` alias in `tnsnames.ora`. Set
   `DB_PASSWORD` in Render's protected environment settings. `DB_USER` defaults
   to `admin`; `WALLET_PASSWORD` can be set as a protected variable if the
   wallet requires it. The Python Oracle driver uses thin mode by default, so
   no Oracle Instant Client initialization is required.
3. Create an OCI Object Storage bucket and an S3 Compatibility customer secret
   key pair. Fill in the five `OCI_OBJECT_STORAGE_*` variables for both the
   web service and worker. The endpoint is derived from the namespace and
   region. If these values are incomplete, startup logs a warning and uses
   local disk; Render's local disk is ephemeral, so uploads will not persist
   until OCI Object Storage is configured.
4. The `MediaAsset` model stores file metadata in ATP and its existing
   `FileField`/`ImageField` values use the configured Django storage backend.
   No file-content database migration is needed. Existing uploads are not
   copied automatically; migrate old media objects to OCI separately while
   preserving their stored file names.
5. Configure the ATP network access control list to allow connections from
   the Render service's outbound IP addresses, or use an approved private
   network connection. The app cannot connect if ATP blocks Render's egress.

Verification payments are not automatically charged. Users submit a transfer
reference for SadaPay, card transfer, EasyPaisa, or JazzCash, and staff approve
the request in Django admin after independently confirming receipt. Configure
`PAYMENT_INSTRUCTIONS` only with the intended receiver information. Phone OTP
delivery returns unavailable until the SMS provider and credentials are set.
The hourly Celery Beat task applies the five-day subscription grace period.

The local `frontend/.env` and `frontend/.env.local` files are not Render
configuration. Their values are intentionally not copied here.

Database migrations are intentionally not run by the Render build or start
command. Once the wallet and ATP environment variables are configured, review
and apply migrations to the intended Oracle database separately. Switching the
database settings does not copy existing PostgreSQL records or uploaded media;
plan and verify those data transfers separately before routing production
traffic to ATP.

```powershell
Set-Location backend
# Configure DJANGO_SECRET_KEY and REDIS_URL in this shell as well.
$env:DJANGO_SETTINGS_MODULE = "config.settings.production"
$env:WALLET_DIR = "C:\path\to\oracle_wallet"
$env:DB_SERVICE_NAME = "ricehub_low"
$env:DB_USER = "admin"
$securePassword = Read-Host "ATP password" -AsSecureString
$env:DB_PASSWORD = [Net.NetworkCredential]::new("", $securePassword).Password
python manage.py migrate --plan
python manage.py migrate
```

After an approved deployment:

1. Verify `https://ricehub-frontend.onrender.com` loads and client-side routes
   refresh without returning 404.
2. Verify the public legal pages load at `/privacy` and `/terms`, and the
   public account-deletion page loads at `/delete-account`. Add the deployed
   privacy policy URL to the app-store listing and complete the legal operator
   identity/contact details before public launch.
3. Verify the backend `/health/` returns HTTP 200 with `"database": "ok"`.
4. Check browser network requests use HTTPS for API/media and WSS for sockets;
   verify login, media upload, email, and push delivery if enabled.
5. Confirm the Celery worker and Beat are running without repeated task errors.

The repository configuration cannot verify Render Dashboard values, attached
custom domains, actual deployed service health, or OCI state. No live Render
deployment or Oracle migration is performed by these instructions.
