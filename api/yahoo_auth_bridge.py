#!/usr/bin/env python3
"""Local, read-only Yahoo OAuth and Fantasy Sports bridge for Fantasy HQ.

Secrets and tokens remain in this server process or its private token store. The
browser receives normalized Fantasy Sports payloads, never OAuth credentials.
"""
from __future__ import annotations

import argparse
import base64
import re
import json
import os
import secrets
import ssl
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable

AUTH_URL = "https://api.login.yahoo.com/oauth2/request_auth"
TOKEN_URL = "https://api.login.yahoo.com/oauth2/get_token"
FANTASY_ROOT = "https://fantasysports.yahooapis.com/fantasy/v2"


def _load_local_env(path: Path) -> None:
    """Load a developer .env without overriding the real environment."""
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


@dataclass(frozen=True)
class YahooConfig:
    client_id: str
    client_secret: str
    redirect_uri: str
    app_url: str = "http://127.0.0.1:8000/"
    allowed_origin: str = "http://127.0.0.1:8000"
    token_store: Path = Path.home() / ".fantasyhq" / "yahoo_tokens.json"
    tls_cert_file: Path = Path(".certs/yahoo-localhost.pem")
    tls_key_file: Path = Path(".certs/yahoo-localhost-key.pem")

    @classmethod
    def from_env(cls) -> "YahooConfig":
        configured = os.environ.get("YAHOO_TOKEN_STORE", "").strip()
        return cls(
            client_id=os.environ.get("YAHOO_CLIENT_ID", "").strip(),
            client_secret=os.environ.get("YAHOO_CLIENT_SECRET", "").strip(),
            redirect_uri=os.environ.get(
                "YAHOO_REDIRECT_URI", "https://localhost:8787/api/yahoo/callback"
            ).strip(),
            app_url=os.environ.get("YAHOO_APP_URL", "http://127.0.0.1:8000/").strip(),
            allowed_origin=os.environ.get(
                "YAHOO_ALLOWED_ORIGIN", "http://127.0.0.1:8000"
            ).rstrip("/"),
            token_store=Path(configured).expanduser()
            if configured
            else Path.home() / ".fantasyhq" / "yahoo_tokens.json",
            tls_cert_file=Path(os.environ.get("YAHOO_TLS_CERT_FILE", ".certs/yahoo-localhost.pem")).expanduser(),
            tls_key_file=Path(os.environ.get("YAHOO_TLS_KEY_FILE", ".certs/yahoo-localhost-key.pem")).expanduser(),
        )

    @property
    def ready(self) -> bool:
        parsed = urllib.parse.urlsplit(self.redirect_uri)
        return bool(self.client_id and self.client_secret and parsed.scheme == "https" and parsed.netloc)

    @property
    def tls_ready(self) -> bool:
        return self.tls_cert_file.is_file() and self.tls_key_file.is_file()


class TokenStore:
    def __init__(self, path: Path):
        self.path = path

    def read(self) -> dict[str, Any] | None:
        try:
            value = json.loads(self.path.read_text(encoding="utf-8"))
            return value if isinstance(value, dict) else None
        except (FileNotFoundError, json.JSONDecodeError, OSError):
            return None

    def write(self, token: dict[str, Any]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        os.chmod(self.path.parent, 0o700)
        fd, tmp_name = tempfile.mkstemp(prefix="yahoo-token-", dir=self.path.parent)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                json.dump(token, handle, sort_keys=True)
            os.chmod(tmp_name, 0o600)
            os.replace(tmp_name, self.path)
        finally:
            if os.path.exists(tmp_name):
                os.unlink(tmp_name)

    def clear(self) -> None:
        try:
            self.path.unlink()
        except FileNotFoundError:
            pass


class OAuthStateStore:
    def __init__(self, ttl_seconds: int = 600, clock: Callable[[], float] = time.time):
        self.ttl_seconds = ttl_seconds
        self.clock = clock
        self._states: dict[str, float] = {}

    def issue(self) -> str:
        now = self.clock()
        self._states = {key: stamp for key, stamp in self._states.items() if now - stamp < self.ttl_seconds}
        value = secrets.token_urlsafe(32)
        self._states[value] = now
        return value

    def consume(self, value: str) -> bool:
        stamp = self._states.pop(value, None)
        return stamp is not None and self.clock() - stamp < self.ttl_seconds


class YahooOAuthClient:
    def __init__(
        self,
        config: YahooConfig,
        store: TokenStore,
        opener: Callable[..., Any] = urllib.request.urlopen,
        clock: Callable[[], float] = time.time,
        logger: Callable[[str], None] = print,
    ):
        self.config, self.store, self.opener, self.clock, self.logger = config, store, opener, clock, logger

    def _log(self, event: str, **fields: Any) -> None:
        rendered = " ".join(f"{key}={str(value).lower() if isinstance(value, bool) else value}" for key, value in fields.items())
        self.logger(f"[Yahoo OAuth] {event}{' ' if rendered else ''}{rendered}")

    def _safe_oauth_text(self, value: Any, sensitive_values: list[str]) -> str:
        text = str(value or "").replace("\r", " ").replace("\n", " ")
        for sensitive in [self.config.client_id, self.config.client_secret, *sensitive_values]:
            if sensitive:
                text = text.replace(str(sensitive), "[REDACTED]")
        text = re.sub(
            r"(?i)(authorization|client_secret|access_token|refresh_token|code)\s*[:=]\s*[^\s&,;]+",
            r"\1=[REDACTED]",
            text,
        )
        return text[:300] or "not_provided"

    def authorization_url(self, state: str) -> str:
        query = urllib.parse.urlencode(
            {
                "client_id": self.config.client_id,
                "redirect_uri": self.config.redirect_uri,
                "response_type": "code",
                "state": state,
                "language": "en-us",
            }
        )
        self._log(
            "authorization_request",
            client_id_configured=bool(self.config.client_id),
            redirect_uri=self.config.redirect_uri,
            response_type="code",
            state_present=bool(state),
        )
        return f"{AUTH_URL}?{query}"

    def _token_request(self, fields: dict[str, str]) -> dict[str, Any]:
        sensitive_values = [fields.get("code", ""), fields.get("refresh_token", "")]
        self._log(
            "token_request",
            endpoint=TOKEN_URL,
            client_id_configured=bool(self.config.client_id),
            authentication_method="client_secret_basic",
            grant_type=fields.get("grant_type", "missing"),
            authorization_code_present=bool(fields.get("code")),
            redirect_uri=fields.get("redirect_uri", "missing"),
            redirect_uri_matches_config=(fields.get("redirect_uri") == self.config.redirect_uri),
        )
        credentials = base64.b64encode(
            f"{self.config.client_id}:{self.config.client_secret}".encode()
        ).decode()
        request = urllib.request.Request(
            TOKEN_URL,
            data=urllib.parse.urlencode(fields).encode(),
            headers={
                "Authorization": f"Basic {credentials}",
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
            },
            method="POST",
        )
        try:
            with self.opener(request, timeout=15) as response:
                status = int(getattr(response, "status", response.getcode() if hasattr(response, "getcode") else 200))
                payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            status = int(exc.code)
            try:
                raw = exc.read(16384).decode("utf-8", errors="replace")
                parsed = json.loads(raw) if raw else {}
            except (json.JSONDecodeError, OSError):
                parsed = {}
            finally:
                exc.close()
            error = self._safe_oauth_text(parsed.get("error", "http_error"), sensitive_values)
            description = self._safe_oauth_text(
                parsed.get("error_description") or parsed.get("error_description_en") or exc.reason,
                sensitive_values,
            )
            self._log("token_response", http_status=status, error=error, error_description=description)
            raise RuntimeError(f"Yahoo OAuth token exchange rejected ({status}, {error})") from None
        except urllib.error.URLError:
            self._log("token_response", http_status="network_error", error="network_error", error_description="Yahoo token endpoint was unreachable")
            raise RuntimeError("Yahoo OAuth token endpoint was unreachable") from None
        error = self._safe_oauth_text(payload.get("error", "none"), sensitive_values)
        description = self._safe_oauth_text(payload.get("error_description", "not_provided"), sensitive_values)
        self._log("token_response", http_status=status, error=error, error_description=description)
        if not payload.get("access_token"):
            raise RuntimeError("Yahoo token response did not include an access token")
        return payload

    def _persist(self, payload: dict[str, Any], old: dict[str, Any] | None = None) -> dict[str, Any]:
        token = dict(payload)
        if not token.get("refresh_token") and old and old.get("refresh_token"):
            token["refresh_token"] = old["refresh_token"]
        token["obtained_at"] = int(self.clock())
        token["expires_at"] = int(self.clock()) + int(token.get("expires_in", 3600))
        self.store.write(token)
        saved = self.store.read()
        access_saved = bool(saved and saved.get("access_token") == token.get("access_token"))
        refresh_saved = bool(saved and (not token.get("refresh_token") or saved.get("refresh_token") == token.get("refresh_token")))
        self._log(
            "token_persisted",
            access_token_present=bool(saved and saved.get("access_token")),
            refresh_token_present=bool(saved and saved.get("refresh_token")),
            latest_refresh_token_persisted=refresh_saved,
            expires_at_present=bool(saved and saved.get("expires_at")),
        )
        if not access_saved or not refresh_saved:
            raise RuntimeError("Yahoo authorization could not be verified in the private token store")
        return token

    def exchange_code(self, code: str) -> dict[str, Any]:
        return self._persist(
            self._token_request(
                {
                    "grant_type": "authorization_code",
                    "redirect_uri": self.config.redirect_uri,
                    "code": code,
                }
            )
        )

    def token_status(self, token: dict[str, Any] | None = None) -> dict[str, Any]:
        token = token if token is not None else self.store.read()
        now = int(self.clock())
        obtained_at = int(token.get("obtained_at", 0)) if token else 0
        expires_at = int(token.get("expires_at", 0)) if token else 0
        return {
            "access_token_present": bool(token and token.get("access_token")),
            "refresh_token_present": bool(token and token.get("refresh_token")),
            "token_age_seconds": max(0, now - obtained_at) if obtained_at else "unknown",
            "expires_in_seconds": expires_at - now if expires_at else "unknown",
            "expiry_state": "fresh" if expires_at > now else "expired" if expires_at else "unknown",
        }

    def access_token_with_metadata(self) -> tuple[str, dict[str, Any]]:
        token = self.store.read()
        if not token or not token.get("access_token"):
            raise PermissionError("Yahoo is not connected")
        if int(token.get("expires_at", 0)) > int(self.clock()) + 60:
            return str(token["access_token"]), {**self.token_status(token), "refresh_attempted": False}
        refresh = token.get("refresh_token")
        if not refresh:
            raise PermissionError("Yahoo authorization expired; reconnect is required")
        refreshed = self._token_request(
            {"grant_type": "refresh_token", "redirect_uri": self.config.redirect_uri, "refresh_token": refresh}
        )
        persisted = self._persist(refreshed, token)
        return str(persisted["access_token"]), {**self.token_status(persisted), "refresh_attempted": True}

    def access_token(self) -> str:
        return self.access_token_with_metadata()[0]


class YahooFantasyRequestError(RuntimeError):
    def __init__(self, classification: str, message: str, *, http_status: int | None = None,
                 yahoo_error_code: str = "not_provided", yahoo_error_message: str = "not_provided",
                 reconnect_required: bool = False):
        super().__init__(message)
        self.classification = classification
        self.http_status = http_status
        self.yahoo_error_code = yahoo_error_code
        self.yahoo_error_message = yahoo_error_message
        self.reconnect_required = reconnect_required


class YahooFantasyClient:
    def __init__(self, oauth: YahooOAuthClient, opener: Callable[..., Any] = urllib.request.urlopen,
                 logger: Callable[[str], None] | None = None):
        self.oauth, self.opener = oauth, opener
        self.logger = logger or getattr(oauth, "logger", print)

    def _log(self, event: str, **fields: Any) -> None:
        rendered = " ".join(f"{key}={str(value).lower() if isinstance(value, bool) else value}" for key, value in fields.items())
        self.logger(f"[Yahoo Fantasy] {event}{' ' if rendered else ''}{rendered}")

    def _safe_text(self, value: Any, token: str = "") -> str:
        safe = getattr(self.oauth, "_safe_oauth_text", None)
        if callable(safe):
            return safe(value, [token])
        text = str(value or "").replace("\r", " ").replace("\n", " ")
        if token:
            text = text.replace(token, "[REDACTED]")
        text = re.sub(r"(?i)(authorization|client_secret|access_token|refresh_token|code)\s*[:=]\s*[^\s&,;]+", r"\1=[REDACTED]", text)
        return text[:300] or "not_provided"

    def _error_details(self, payload: Any, token: str = "") -> tuple[str, str]:
        error: Any = None
        if isinstance(payload, dict):
            error = payload.get("error")
            if error is None:
                for value in payload.values():
                    code, message = self._error_details(value, token)
                    if code != "not_provided" or message != "not_provided":
                        return code, message
        elif isinstance(payload, list):
            for value in payload:
                code, message = self._error_details(value, token)
                if code != "not_provided" or message != "not_provided":
                    return code, message
        if isinstance(error, dict):
            code = error.get("code") or error.get("error") or error.get("type")
            message = error.get("description") or error.get("message") or error.get("detail")
            return self._safe_text(code, token), self._safe_text(message, token)
        if error is not None:
            message = payload.get("error_description") or payload.get("message") if isinstance(payload, dict) else None
            return self._safe_text(error, token), self._safe_text(message, token)
        return "not_provided", "not_provided"

    @staticmethod
    def _classification(status: int) -> tuple[str, str, bool]:
        if status == 401:
            return "INVALID_OR_EXPIRED_TOKEN", "Yahoo rejected the access token as invalid or expired; reconnect or token refresh may be required.", True
        if status == 403:
            return "INSUFFICIENT_FANTASY_PERMISSION", "Yahoo denied Fantasy Sports access; verify the app has Fantasy Sports Read permission and that this account can access the league.", False
        if status in (400, 404, 405, 406, 415, 422):
            return "MALFORMED_OR_UNSUPPORTED_ENDPOINT", "Yahoo rejected the Fantasy Sports resource; the endpoint may be malformed or unsupported.", False
        return "YAHOO_API_ERROR", f"Yahoo Fantasy Sports returned HTTP {status}; the previous valid snapshot remains available.", False

    def get(self, resource: str) -> dict[str, Any]:
        if hasattr(self.oauth, "access_token_with_metadata"):
            access_token, token_meta = self.oauth.access_token_with_metadata()
        else:
            access_token, token_meta = self.oauth.access_token(), {
                "access_token_present": True, "token_age_seconds": "unknown",
                "expires_in_seconds": "unknown", "expiry_state": "unknown", "refresh_attempted": False,
            }
        separator = "&" if "?" in resource else "?"
        url = f"{FANTASY_ROOT}/{resource.lstrip('/')}{separator}format=json"
        request = urllib.request.Request(
            url,
            headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
            method="GET",
        )
        common = {
            "resource": resource, "method": "GET", "access_token_present": token_meta["access_token_present"],
            "token_age_seconds": token_meta["token_age_seconds"], "expiry_state": token_meta["expiry_state"],
            "refresh_attempted": token_meta["refresh_attempted"],
        }
        self._log("request", endpoint=FANTASY_ROOT, **common)
        try:
            with self.opener(request, timeout=20) as response:
                status = int(getattr(response, "status", 200))
                raw = response.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            status = int(exc.code)
            try:
                raw = exc.read(16384).decode("utf-8", errors="replace")
                error_payload = json.loads(raw) if raw else {}
            except (json.JSONDecodeError, OSError):
                error_payload = {}
            finally:
                exc.close()
            code, message = self._error_details(error_payload, access_token)
            classification, public_message, reconnect_required = self._classification(status)
            self._log("response", http_status=status, classification=classification, yahoo_error_code=code,
                      yahoo_error_message=message, **common)
            raise YahooFantasyRequestError(classification, public_message, http_status=status,
                                            yahoo_error_code=code, yahoo_error_message=message,
                                            reconnect_required=reconnect_required) from None
        except urllib.error.URLError:
            self._log("response", http_status="network_error", classification="NETWORK_FAILURE",
                      yahoo_error_code="network_error", yahoo_error_message="Yahoo Fantasy Sports endpoint was unreachable", **common)
            raise YahooFantasyRequestError("NETWORK_FAILURE", "Yahoo Fantasy Sports could not be reached; the previous valid snapshot remains available.") from None
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            self._log("parse_failure", http_status=status, classification="PARSER_RESPONSE_SHAPE_FAILURE",
                      yahoo_error_code="invalid_json", yahoo_error_message="Response was not valid JSON", **common)
            raise YahooFantasyRequestError("PARSER_RESPONSE_SHAPE_FAILURE", "Yahoo returned an unreadable Fantasy Sports response; the previous valid snapshot remains available.", http_status=status) from None
        if not isinstance(payload, dict):
            raise YahooFantasyRequestError("PARSER_RESPONSE_SHAPE_FAILURE", "Yahoo returned an unsupported Fantasy Sports response shape; the previous valid snapshot remains available.", http_status=status)
        self._log("response", http_status=status, classification="SUCCESS", yahoo_error_code="none", yahoo_error_message="none", **common)
        return payload

    def discover_leagues(self, season: int = 2026) -> dict[str, Any]:
        # Yahoo documents the logged-in NFL game collection through game_keys=nfl.
        # The browser normalizer applies the requested season to returned leagues.
        _ = int(season)
        return self.get("users;use_login=1/games;game_keys=nfl/leagues")

    def league_bundle(self, league_key: str) -> dict[str, Any]:
        safe_key = urllib.parse.quote(league_key, safe=".")
        resources = {
            "league": f"league/{safe_key}",
            "settings": f"league/{safe_key}/settings",
            "teams": f"league/{safe_key}/teams",
            "transactions": f"league/{safe_key}/transactions;count=50",
            "standings": f"league/{safe_key}/standings",
            "matchups": f"league/{safe_key}/scoreboard",
        }
        payload: dict[str, Any] = {"leagueKey": league_key, "fetchedAt": _iso_now()}
        errors: dict[str, str] = {}
        for name, resource in resources.items():
            try:
                payload[name] = self.get(resource)
            except Exception as exc:  # preserve successful subsystems
                errors[name] = _safe_error(exc)
        payload["teamRosters"] = {}
        for team_key in sorted(set(_find_scalar_values(payload.get("teams"), "team_key"))):
            if not team_key:
                continue
            try:
                safe_team = urllib.parse.quote(str(team_key), safe=".")
                payload["teamRosters"][str(team_key)] = self.get(f"team/{safe_team}/roster")
            except Exception as exc:
                errors[f"roster:{team_key}"] = _safe_error(exc)
        payload["players"] = {"pages": []}
        for start in (0, 100, 200):
            try:
                payload["players"]["pages"].append(
                    self.get(f"league/{safe_key}/players;status=A;start={start};count=100")
                )
            except Exception as exc:
                errors[f"players:{start}"] = _safe_error(exc)
                break
        payload["errors"] = errors
        return payload


def _iso_now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _find_scalar_values(payload: Any, key: str) -> list[Any]:
    values: list[Any] = []
    if isinstance(payload, dict):
        if key in payload and not isinstance(payload[key], (dict, list)):
            values.append(payload[key])
        for value in payload.values():
            values.extend(_find_scalar_values(value, key))
    elif isinstance(payload, list):
        for value in payload:
            values.extend(_find_scalar_values(value, key))
    return values


def _safe_error(exc: Exception) -> str:
    if isinstance(exc, YahooFantasyRequestError):
        return str(exc)
    if isinstance(exc, urllib.error.HTTPError):
        return f"Yahoo request failed ({exc.code})"
    if isinstance(exc, PermissionError):
        return str(exc)
    return "Yahoo request failed; the previous valid snapshot remains available"


def create_tls_context(config: YahooConfig) -> ssl.SSLContext:
    if not config.tls_ready:
        raise FileNotFoundError(
            "Local TLS certificate/key not found. Follow docs/YAHOO_SYNC_FOUNDATION.md before starting the Yahoo bridge."
        )
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    context.load_cert_chain(certfile=str(config.tls_cert_file), keyfile=str(config.tls_key_file))
    return context


def make_handler(
    config: YahooConfig,
    oauth: YahooOAuthClient,
    fantasy: YahooFantasyClient,
    states: OAuthStateStore,
):
    class YahooBridgeHandler(BaseHTTPRequestHandler):
        server_version = "FantasyHQYahooBridge/1.0"

        def log_message(self, format_string: str, *args: Any) -> None:
            # Never log query strings: callbacks can contain authorization codes.
            print(f"[{self.log_date_time_string()}] {self.command} {urllib.parse.urlsplit(self.path).path}")

        def _cors(self) -> None:
            origin = self.headers.get("Origin", "").rstrip("/")
            if origin and origin == config.allowed_origin:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")

        def _json(self, status: int, payload: dict[str, Any]) -> None:
            body = json.dumps(payload, separators=(",", ":")).encode()
            self.send_response(status)
            self._cors()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _redirect(self, location: str) -> None:
            self.send_response(302)
            self.send_header("Location", location)
            self.send_header("Cache-Control", "no-store")
            self.end_headers()

        def do_OPTIONS(self) -> None:  # noqa: N802
            self.send_response(204)
            self._cors()
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()

        def do_GET(self) -> None:  # noqa: N802
            parsed = urllib.parse.urlsplit(self.path)
            query = urllib.parse.parse_qs(parsed.query)
            try:
                if parsed.path in ("/health", "/api/yahoo/status"):
                    token = oauth.store.read()
                    self._json(200, {"ready": config.ready and config.tls_ready, "connected": bool(token and token.get("access_token")), "provider": "Yahoo", "readOnly": True, "https": True})
                elif parsed.path == "/api/yahoo/connect":
                    if not config.ready:
                        self._json(503, {"error": "Yahoo OAuth environment is not configured"})
                    else:
                        self._redirect(oauth.authorization_url(states.issue()))
                elif parsed.path == "/api/yahoo/callback":
                    state, code = query.get("state", [""])[0], query.get("code", [""])[0]
                    if query.get("error"):
                        if state:
                            states.consume(state)
                        self._redirect(f"{config.app_url.rstrip('/')}?yahoo=cancelled")
                    elif not state or not states.consume(state):
                        self._json(400, {"error": "Invalid or expired OAuth state"})
                    elif not code:
                        self._json(400, {"error": "Yahoo callback did not include an authorization code"})
                    else:
                        oauth.exchange_code(code)
                        self._redirect(f"{config.app_url.rstrip('/')}?yahoo=connected")
                elif parsed.path == "/api/yahoo/leagues":
                    season = int(query.get("season", ["2026"])[0])
                    self._json(200, {"fetchedAt": _iso_now(), "season": season, "raw": fantasy.discover_leagues(season)})
                elif parsed.path == "/api/yahoo/sync":
                    league_key = query.get("league_key", [""])[0].strip()
                    if not league_key or not all(ch.isalnum() or ch in ".-_" for ch in league_key):
                        self._json(400, {"error": "A valid Yahoo league key is required"})
                    else:
                        self._json(200, fantasy.league_bundle(league_key))
                else:
                    self._json(404, {"error": "Not found"})
            except YahooFantasyRequestError as exc:
                self._json(
                    exc.http_status if exc.http_status in (401, 403) else 502,
                    {
                        "error": str(exc),
                        "classification": exc.classification,
                        "yahooHttpStatus": exc.http_status,
                        "yahooErrorCode": exc.yahoo_error_code,
                        "reconnectRequired": exc.reconnect_required,
                    },
                )
            except PermissionError as exc:
                self._json(401, {"error": _safe_error(exc), "reconnectRequired": True})
            except Exception as exc:
                self._json(502, {"error": _safe_error(exc)})

        def do_POST(self) -> None:  # noqa: N802
            parsed = urllib.parse.urlsplit(self.path)
            origin = self.headers.get("Origin", "").rstrip("/")
            if origin and origin != config.allowed_origin:
                self._json(403, {"error": "Origin is not allowed"})
                return
            if parsed.path == "/api/yahoo/disconnect":
                oauth.store.clear()
                self._json(200, {"connected": False, "message": "Local Yahoo authorization removed"})
            else:
                self._json(404, {"error": "Not found"})

    return YahooBridgeHandler


def main() -> int:
    parser = argparse.ArgumentParser(description="Fantasy HQ read-only Yahoo bridge")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8787)
    parser.add_argument("--env-file", default=".env")
    args = parser.parse_args()
    _load_local_env(Path(args.env_file))
    config = YahooConfig.from_env()
    if not config.ready:
        print("Yahoo OAuth configuration is incomplete or YAHOO_REDIRECT_URI is not HTTPS.")
        return 2
    try:
        tls_context = create_tls_context(config)
    except (FileNotFoundError, ssl.SSLError, OSError) as exc:
        print(f"Yahoo bridge TLS setup failed: {exc}")
        return 2
    store = TokenStore(config.token_store)
    oauth = YahooOAuthClient(config, store)
    fantasy = YahooFantasyClient(oauth)
    server = ThreadingHTTPServer((args.host, args.port), make_handler(config, oauth, fantasy, OAuthStateStore()))
    server.socket = tls_context.wrap_socket(server.socket, server_side=True)
    print(f"Fantasy HQ Yahoo bridge listening on https://{args.host}:{args.port} (configured={config.ready})")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
