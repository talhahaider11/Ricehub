# Render deployment readiness

The Render Blueprint defines three services:

- `ricehub-backend`: Django/Daphne web service; runs production checks and
  collects static files during build. `/health/` checks database connectivity.
- `ricehub-celery-worker`: Celery worker and Beat scheduler, using
  `backend/Dockerfile.worker`.
- `ricehub-frontend`: Vite static site built from `frontend/`, with SPA route
  rewrites. Its build-time `VITE_API_URL` and `VITE_WS_URL` point to the
  existing `ricehub-umfd.onrender.com` backend.

Uploaded media uses the configured S3-compatible storage; backend static files
use WhiteNoise.

## Render Dashboard setup

Apply the Blueprint in Render, then open each service's **Environment** page and
confirm the following settings. Values marked as secrets must be entered as
protected environment values; never commit them to this repository.

| Service | Variable | Required value |
| --- | --- | --- |
| `ricehub-backend` and `ricehub-celery-worker` | `DJANGO_SECRET_KEY` | A new, unique, high-entropy Django secret; keep identical on both services |
| Both backend services | `DATABASE_URL` | The approved Neon PostgreSQL connection string, with SSL enabled |
| Both backend services | `REDIS_URL` | The Render Redis connection string reachable by both services |
| Both backend services | `AWS_STORAGE_BUCKET_NAME`, `AWS_S3_ENDPOINT_URL`, `AWS_S3_REGION_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | The S3-compatible bucket endpoint, region, and restricted credentials |
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

Verification payments are not automatically charged. Users submit a transfer
reference for SadaPay, card transfer, EasyPaisa, or JazzCash, and staff approve
the request in Django admin after independently confirming receipt. Configure
`PAYMENT_INSTRUCTIONS` only with the intended receiver information. Phone OTP
delivery returns unavailable until the SMS provider and credentials are set.
The hourly Celery Beat task applies the five-day subscription grace period.

The local `frontend/.env` and `frontend/.env.local` files are not Render
configuration. Their values are intentionally not copied here.

Database migrations are intentionally not run by the Render build or start
command. Review and apply migrations to the intended Neon database separately,
only after explicit approval:

```powershell
Set-Location backend
$env:DJANGO_SETTINGS_MODULE = "config.settings.production"
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
custom domains, actual deployed service health, or Neon state. No live Render
deployment or Neon migration is performed by these instructions.
