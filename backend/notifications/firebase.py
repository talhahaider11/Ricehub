import json
import os
from pathlib import Path
from threading import Lock

from firebase_admin import credentials, get_app, initialize_app


class FirebaseConfigurationError(RuntimeError):
    pass


_initialization_lock = Lock()


def get_firebase_app():
    try:
        return get_app()
    except ValueError:
        pass

    with _initialization_lock:
        try:
            return get_app()
        except ValueError:
            pass

        credentials_json = os.environ.get("FIREBASE_CREDENTIALS_JSON", "").strip()
        credentials_path = (
            os.environ.get("FIREBASE_CREDENTIALS_PATH", "").strip()
            or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
        )

        if credentials_json:
            try:
                service_account = json.loads(credentials_json)
            except json.JSONDecodeError as exc:
                raise FirebaseConfigurationError(
                    "FIREBASE_CREDENTIALS_JSON must contain valid JSON."
                ) from exc
            try:
                firebase_credentials = credentials.Certificate(service_account)
            except (TypeError, ValueError, KeyError) as exc:
                raise FirebaseConfigurationError(
                    "FIREBASE_CREDENTIALS_JSON is not a valid service account."
                ) from exc
        elif credentials_path:
            path = Path(credentials_path)
            if not path.is_file():
                raise FirebaseConfigurationError(
                    "The configured Firebase credentials file does not exist."
                )
            try:
                firebase_credentials = credentials.Certificate(str(path))
            except (TypeError, ValueError, KeyError) as exc:
                raise FirebaseConfigurationError(
                    "The configured Firebase credentials file is invalid."
                ) from exc
        else:
            raise FirebaseConfigurationError(
                "Configure FIREBASE_CREDENTIALS_JSON or FIREBASE_CREDENTIALS_PATH."
            )

        return initialize_app(firebase_credentials)
