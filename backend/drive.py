"""
DERZEN - Google Drive upload, two routes.

  chrome  drops the file into the Drive tab that is already signed in. No API
          project, no OAuth consent screen, no token on disk.
  api     the official Google API client with OAuth user credentials. Slower to
          set up but it can convert to a Google Doc or Sheet and it returns a
          proper share link every time.

api setup, done once:
  1. Create an OAuth 2.0 Desktop client in Google Cloud Console and download
     the client secrets JSON.
  2. Point GOOGLE_OAUTH_CLIENT in .env at that file and GOOGLE_OAUTH_TOKEN at
     the path where the reusable token should be cached.
  3. The first upload opens a consent screen. After that the cached token is
     reused silently.
"""
from __future__ import annotations

import asyncio
import os
from pathlib import Path
from typing import Optional

import config
import file_manager

SCOPES = ["https://www.googleapis.com/auth/drive.file"]
DRIVE_MATCH = "drive.google.com"

GOOGLE_DOC_TYPES = {
    ".docx": "application/vnd.google-apps.document",
    ".doc": "application/vnd.google-apps.document",
    ".md": "application/vnd.google-apps.document",
    ".txt": "application/vnd.google-apps.document",
    ".html": "application/vnd.google-apps.document",
    ".xlsx": "application/vnd.google-apps.spreadsheet",
    ".csv": "application/vnd.google-apps.spreadsheet",
}


class DriveError(RuntimeError):
    """Raised when an upload cannot proceed."""


def _resolve(path_or_relative: str) -> Path:
    """Accept either a sandbox relative path or an absolute one inside it."""
    raw = str(path_or_relative or "").strip()
    if not raw:
        raise DriveError("No file was given to upload.")
    candidate = Path(raw)
    if candidate.is_absolute():
        resolved = candidate.resolve()
        base = config.ALLOWED_BASE
        if base not in resolved.parents and resolved != base:
            raise DriveError(f"Refusing to upload a file outside the sandbox: {raw}")
        source = resolved
    else:
        source = file_manager.validate_path(raw)
    if not source.exists() or not source.is_file():
        raise DriveError(f"File to upload does not exist: {raw}")
    return source


# --------------------------------------------------------------------- api
def _load_credentials():
    """Load cached OAuth credentials, refreshing or running the flow if needed."""
    try:
        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request
        from google_auth_oauthlib.flow import InstalledAppFlow
    except ImportError as exc:  # pragma: no cover - dependency guidance
        raise DriveError(
            "The Drive API route needs extra packages. Install them with: "
            "pip install google-api-python-client google-auth-httplib2 "
            "google-auth-oauthlib"
        ) from exc

    client_file = os.getenv("GOOGLE_OAUTH_CLIENT", "").strip()
    token_file = os.getenv("GOOGLE_OAUTH_TOKEN", "").strip()
    if not client_file or not token_file:
        raise DriveError(
            "The Drive API route is not configured. Set GOOGLE_OAUTH_CLIENT and "
            "GOOGLE_OAUTH_TOKEN in .env, or use the chrome route instead."
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


def upload(
    relative_path: str,
    folder_id: Optional[str] = None,
    name: Optional[str] = None,
    as_google_doc: bool = False,
) -> dict:
    """Upload through the API and return {"id", "name", "link"}."""
    try:
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaFileUpload
    except ImportError as exc:  # pragma: no cover - dependency guidance
        raise DriveError(
            "The Drive API route needs the google-api-python-client package."
        ) from exc

    source = _resolve(relative_path)
    creds = _load_credentials()
    service = build("drive", "v3", credentials=creds, cache_discovery=False)

    metadata = {"name": name or source.name}
    target_folder = (
        folder_id
        or config.DRIVE_FOLDER_ID
        or os.getenv("GOOGLE_DRIVE_FOLDER_ID", "").strip()
    )
    if target_folder:
        metadata["parents"] = [target_folder]
    if as_google_doc:
        converted = GOOGLE_DOC_TYPES.get(source.suffix.lower())
        if converted:
            metadata["mimeType"] = converted

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
        "method": "api",
    }


# ------------------------------------------------------------------ chrome
async def upload_via_chrome(
    path: str, folder_id: Optional[str] = None, name: Optional[str] = None
) -> dict:
    """
    Push the file into the signed in Drive tab. Drive keeps a hidden file input
    on the page, which is what the upload menu itself uses, so this is the same
    code path a manual upload takes.
    """
    import chrome_bridge

    source = _resolve(path)
    target_folder = folder_id or config.DRIVE_FOLDER_ID
    url = (
        f"https://drive.google.com/drive/folders/{target_folder}"
        if target_folder
        else "https://drive.google.com/drive/my-drive"
    )

    page = await chrome_bridge.open_tab(url, match=DRIVE_MATCH)
    await page.goto(url, wait_until="domcontentloaded", timeout=60000)
    await page.wait_for_timeout(3500)

    inputs = page.locator("input[type=file]")
    if not await inputs.count():
        raise DriveError(
            "The Drive tab did not expose an upload field. Sign in to Drive in "
            "Chrome, or switch this step to the api route."
        )
    try:
        await inputs.first.set_input_files(str(source))
    except Exception as exc:  # noqa: BLE001
        raise DriveError(f"Drive rejected the file: {exc}") from exc

    # Wait for the upload toast to settle rather than guessing a duration.
    link = ""
    for _ in range(40):
        await page.wait_for_timeout(1500)
        try:
            body = (await page.inner_text("body")).lower()
        except Exception:  # noqa: BLE001
            continue
        if "upload complete" in body or "1 upload complete" in body:
            break
        if "upload failed" in body:
            raise DriveError("Drive reported that the upload failed.")

    try:
        link = await _find_link_in_tab(page, name or source.name)
    except Exception:  # noqa: BLE001
        link = ""

    return {
        "id": "",
        "name": name or source.name,
        "link": link or url,
        "method": "chrome",
        "note": "" if link else "Uploaded. Drive did not hand back a direct link, "
                                "so the folder address is returned instead.",
    }


async def _find_link_in_tab(page, filename: str) -> str:
    """Look for the freshly uploaded row and read its file id from the DOM."""
    await page.wait_for_timeout(1500)
    row = page.locator(f"div[role=row]:has-text('{filename[:40]}')").first
    if not await row.count():
        return ""
    for attribute in ("data-id", "data-target-id", "id"):
        value = await row.get_attribute(attribute)
        if value and len(value) > 20:
            token = value.split(":")[-1]
            return f"https://drive.google.com/file/d/{token}/view"
    return ""


# -------------------------------------------------------------------- auto
async def upload_auto(
    path: str,
    method: str = "auto",
    folder_id: Optional[str] = None,
    name: Optional[str] = None,
    as_google_doc: bool = False,
) -> dict:
    """
    Upload by whichever route is available.
    auto tries the Chrome tab first, then the API.
    Returns {"id", "name", "link", "method"}.
    """
    method = (method or config.DRIVE_METHOD or "auto").strip().lower()

    if method == "api":
        return await asyncio.to_thread(upload, path, folder_id, name, as_google_doc)

    if method == "chrome":
        return await upload_via_chrome(path, folder_id, name)

    if as_google_doc:
        # Conversion only exists on the API route, so try that one first.
        try:
            return await asyncio.to_thread(upload, path, folder_id, name, True)
        except Exception:  # noqa: BLE001
            pass
    try:
        return await upload_via_chrome(path, folder_id, name)
    except Exception as chrome_error:  # noqa: BLE001
        try:
            return await asyncio.to_thread(upload, path, folder_id, name, as_google_doc)
        except Exception as api_error:  # noqa: BLE001
            raise DriveError(
                f"Both Drive routes failed. Chrome tab: {chrome_error}. "
                f"API: {api_error}"
            ) from api_error


async def status() -> dict:
    import chrome_bridge

    return {
        "method": config.DRIVE_METHOD,
        "tab_open": await chrome_bridge.find_tab(DRIVE_MATCH) is not None,
        "api_configured": bool(
            os.getenv("GOOGLE_OAUTH_CLIENT", "").strip()
            and os.getenv("GOOGLE_OAUTH_TOKEN", "").strip()
        ),
        "folder_id": config.DRIVE_FOLDER_ID,
    }
"""
DERZEN - Google Drive upload, two routes.

  chrome  drops the file into the Drive tab that is already signed in. No API
          project, no OAuth consent screen, no token on disk.
  api     the official Google API client with OAuth user credentials. Slower to
          set up but it can convert to a Google Doc or Sheet and it returns a
          proper share link every time.

api setup, done once:
  1. Create an OAuth 2.0 Desktop client in Google Cloud Console and download
     the client secrets JSON.
  2. Point GOOGLE_OAUTH_CLIENT in .env at that file and GOOGLE_OAUTH_TOKEN at
     the path where the reusable token should be cached.
  3. The first upload opens a consent screen. After that the cached token is
     reused silently.
"""
from __future__ import annotations

import asyncio
import os
from pathlib import Path
from typing import Optional

import config
import file_manager

SCOPES = ["https://www.googleapis.com/auth/drive.file"]
DRIVE_MATCH = "drive.google.com"

GOOGLE_DOC_TYPES = {
    ".docx": "application/vnd.google-apps.document",
    ".doc": "application/vnd.google-apps.document",
    ".md": "application/vnd.google-apps.document",
    ".txt": "application/vnd.google-apps.document",
    ".html": "application/vnd.google-apps.document",
    ".xlsx": "application/vnd.google-apps.spreadsheet",
    ".csv": "application/vnd.google-apps.spreadsheet",
}


class DriveError(RuntimeError):
    """Raised when an upload cannot proceed."""


def _resolve(path_or_relative: str) -> Path:
    """Accept either a sandbox relative path or an absolute one inside it."""
    raw = str(path_or_relative or "").strip()
    if not raw:
        raise DriveError("No file was given to upload.")
    candidate = Path(raw)
    if candidate.is_absolute():
        resolved = candidate.resolve()
        base = config.ALLOWED_BASE
        if base not in resolved.parents and resolved != base:
            raise DriveError(f"Refusing to upload a file outside the sandbox: {raw}")
        source = resolved
    else:
        source = file_manager.validate_path(raw)
    if not source.exists() or not source.is_file():
        raise DriveError(f"File to upload does not exist: {raw}")
    return source


# --------------------------------------------------------------------- api
def _load_credentials():
    """Load cached OAuth credentials, refreshing or running the flow if needed."""
    try:
        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request
        from google_auth_oauthlib.flow import InstalledAppFlow
    except ImportError as exc:  # pragma: no cover - dependency guidance
        raise DriveError(
            "The Drive API route needs extra packages. Install them with: "
            "pip install google-api-python-client google-auth-httplib2 "
            "google-auth-oauthlib"
        ) from exc

    client_file = os.getenv("GOOGLE_OAUTH_CLIENT", "").strip()
    token_file = os.getenv("GOOGLE_OAUTH_TOKEN", "").strip()
    if not client_file or not token_file:
        raise DriveError(
            "The Drive API route is not configured. Set GOOGLE_OAUTH_CLIENT and "
            "GOOGLE_OAUTH_TOKEN in .env, or use the chrome route instead."
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


def upload(
    relative_path: str,
    folder_id: Optional[str] = None,
    name: Optional[str] = None,
    as_google_doc: bool = False,
) -> dict:
    """Upload through the API and return {"id", "name", "link"}."""
    try:
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaFileUpload
    except ImportError as exc:  # pragma: no cover - dependency guidance
        raise DriveError(
            "The Drive API route needs the google-api-python-client package."
        ) from exc

    source = _resolve(relative_path)
    creds = _load_credentials()
    service = build("drive", "v3", credentials=creds, cache_discovery=False)

    metadata = {"name": name or source.name}
    target_folder = (
        folder_id
        or config.DRIVE_FOLDER_ID
        or os.getenv("GOOGLE_DRIVE_FOLDER_ID", "").strip()
    )
    if target_folder:
        metadata["parents"] = [target_folder]
    if as_google_doc:
        converted = GOOGLE_DOC_TYPES.get(source.suffix.lower())
        if converted:
            metadata["mimeType"] = converted

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
        "method": "api",
    }


# ------------------------------------------------------------------ chrome
async def upload_via_chrome(
    path: str, folder_id: Optional[str] = None, name: Optional[str] = None
) -> dict:
    """
    Push the file into the signed in Drive tab. Drive keeps a hidden file input
    on the page, which is what the upload menu itself uses, so this is the same
    code path a manual upload takes.
    """
    import chrome_bridge

    source = _resolve(path)
    target_folder = folder_id or config.DRIVE_FOLDER_ID
    url = (
        f"https://drive.google.com/drive/folders/{target_folder}"
        if target_folder
        else "https://drive.google.com/drive/my-drive"
    )

    page = await chrome_bridge.open_tab(url, match=DRIVE_MATCH)
    await page.goto(url, wait_until="domcontentloaded", timeout=60000)
    await page.wait_for_timeout(3500)

    inputs = page.locator("input[type=file]")
    if not await inputs.count():
        raise DriveError(
            "The Drive tab did not expose an upload field. Sign in to Drive in "
            "Chrome, or switch this step to the api route."
        )
    try:
        await inputs.first.set_input_files(str(source))
    except Exception as exc:  # noqa: BLE001
        raise DriveError(f"Drive rejected the file: {exc}") from exc

    # Wait for the upload toast to settle rather than guessing a duration.
    link = ""
    for _ in range(40):
        await page.wait_for_timeout(1500)
        try:
            body = (await page.inner_text("body")).lower()
        except Exception:  # noqa: BLE001
            continue
        if "upload complete" in body or "1 upload complete" in body:
            break
        if "upload failed" in body:
            raise DriveError("Drive reported that the upload failed.")

    try:
        link = await _find_link_in_tab(page, name or source.name)
    except Exception:  # noqa: BLE001
        link = ""

    return {
        "id": "",
        "name": name or source.name,
        "link": link or url,
        "method": "chrome",
        "note": "" if link else "Uploaded. Drive did not hand back a direct link, "
                                "so the folder address is returned instead.",
    }


async def _find_link_in_tab(page, filename: str) -> str:
    """Look for the freshly uploaded row and read its file id from the DOM."""
    await page.wait_for_timeout(1500)
    row = page.locator(f"div[role=row]:has-text('{filename[:40]}')").first
    if not await row.count():
        return ""
    for attribute in ("data-id", "data-target-id", "id"):
        value = await row.get_attribute(attribute)
        if value and len(value) > 20:
            token = value.split(":")[-1]
            return f"https://drive.google.com/file/d/{token}/view"
    return ""


# -------------------------------------------------------------------- auto
async def upload_auto(
    path: str,
    method: str = "auto",
    folder_id: Optional[str] = None,
    name: Optional[str] = None,
    as_google_doc: bool = False,
) -> dict:
    """
    Upload by whichever route is available.
    auto tries the Chrome tab first, then the API.
    Returns {"id", "name", "link", "method"}.
    """
    method = (method or config.DRIVE_METHOD or "auto").strip().lower()

    if method == "api":
        return await asyncio.to_thread(upload, path, folder_id, name, as_google_doc)

    if method == "chrome":
        return await upload_via_chrome(path, folder_id, name)

    if as_google_doc:
        # Conversion only exists on the API route, so try that one first.
        try:
            return await asyncio.to_thread(upload, path, folder_id, name, True)
        except Exception:  # noqa: BLE001
            pass
    try:
        return await upload_via_chrome(path, folder_id, name)
    except Exception as chrome_error:  # noqa: BLE001
        try:
            return await asyncio.to_thread(upload, path, folder_id, name, as_google_doc)
        except Exception as api_error:  # noqa: BLE001
            raise DriveError(
                f"Both Drive routes failed. Chrome tab: {chrome_error}. "
                f"API: {api_error}"
            ) from api_error


async def status() -> dict:
    import chrome_bridge

    return {
        "method": config.DRIVE_METHOD,
        "tab_open": await chrome_bridge.find_tab(DRIVE_MATCH) is not None,
        "api_configured": bool(
            os.getenv("GOOGLE_OAUTH_CLIENT", "").strip()
            and os.getenv("GOOGLE_OAUTH_TOKEN", "").strip()
        ),
        "folder_id": config.DRIVE_FOLDER_ID,
    }
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
