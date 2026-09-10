"""
DERZEN - Google Drive upload.

Uploads a local (sandboxed) file to Google Drive using the official Google API
client with OAuth user credentials. Nothing here contains secrets: the OAuth
client config and stored token paths come from the environment / .env, and the
user authorises Drive access once, interactively, on their own machine.

Setup (done once by the user):
  1. Create an OAuth 2.0 Desktop client in Google Cloud Console and download
     the client secrets JSON.
  2. Point GOOGLE_OAUTH_CLIENT in .env at that file, and GOOGLE_OAUTH_TOKEN at
     the path where the reusable token should be cached.
  3. The first upload opens a browser consent screen; after that the cached
     token is reused silently.

If the Google libraries or credentials are missing, this module raises a clear
error rather than failing silently, so the pipeline report shows what to fix.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

import config
import file_manager

SCOPES = ["https://www.googleapis.com/auth/drive.file"]


class DriveError(RuntimeError):
    """Raised when Drive upload cannot proceed (missing libs or credentials)."""


def _load_credentials():
    """Load cached OAuth credentials, refreshing or running the flow if needed."""
    try:
        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request
        from google_auth_oauthlib.flow import InstalledAppFlow
    except ImportError as exc:  # pragma: no cover - dependency guidance
        raise DriveError(
            "Google Drive support needs extra packages. Install them with: "
            "pip install google-api-python-client google-auth-httplib2 "
            "google-auth-oauthlib"
        ) from exc

    client_file = os.getenv("GOOGLE_OAUTH_CLIENT", "").strip()
    token_file = os.getenv("GOOGLE_OAUTH_TOKEN", "").strip()
    if not client_file or not token_file:
        raise DriveError(
            "Google Drive is not configured. Set GOOGLE_OAUTH_CLIENT and "
            "GOOGLE_OAUTH_TOKEN in your .env file."
        )

    creds = None
    if Path(token_file).exists():
        creds = Credentials.from_authorized_user_file(token_file, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not Path(client_file).exists():
                raise DriveError(f"OAuth client file not found: {client_file}")
            flow = InstalledAppFlow.from_client_secrets_file(client_file, SCOPES)
            creds = flow.run_local_server(port=0)
        Path(token_file).write_text(creds.to_json(), encoding="utf-8")
    return creds


def upload(relative_path: str, folder_id: Optional[str] = None, name: Optional[str] = None) -> dict:
    """
    Upload a sandboxed file to Google Drive and return its id and web link.
    'relative_path' is resolved inside ALLOWED_BASE; nothing outside it is read.
    'folder_id' optionally targets a specific Drive folder.
    """
    try:
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaFileUpload
    except ImportError as exc:  # pragma: no cover - dependency guidance
        raise DriveError(
            "Google Drive support needs the google-api-python-client package."
        ) from exc

    source = file_manager.validate_path(relative_path)
    if not source.exists():
        raise DriveError(f"File to upload does not exist: {relative_path}")

    creds = _load_credentials()
    service = build("drive", "v3", credentials=creds, cache_discovery=False)

    metadata = {"name": name or source.name}
    env_folder = os.getenv("GOOGLE_DRIVE_FOLDER_ID", "").strip()
    target_folder = folder_id or env_folder
    if target_folder:
        metadata["parents"] = [target_folder]

    media = MediaFileUpload(str(source), resumable=False)
    created = (
        service.files()
        .create(body=metadata, media_body=media, fields="id, name, webViewLink")
        .execute()
    )
    return {
        "id": created.get("id", ""),
        "name": created.get("name", metadata["name"]),
        "link": created.get("webViewLink", ""),
    }
