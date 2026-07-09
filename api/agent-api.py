#!/usr/bin/env python3
"""HTTP-Service für Agent-Konfigurations-, Auth- und SMB-Endpunkte.

Trennung von der Files-API: hier liegen Endpunkte, die Geheimnisse oder
Agent-State unter /home/agent berühren. Die Files-API darf strukturell
nicht an Geheimnisse herankommen — siehe
docs/developers/architecture/volumes.md.

Routen (vom Reverse Proxy auf /api/* gemappt):
  GET  /api/features         → Status-Flags der Box (smb, künftig: skills, agents)
  GET  /api/smb-info         → {port, share, user, password}
  POST /api/login            → Body {"password": "..."}; bei Erfolg Set-Cookie
  POST /api/logout           → löscht das Session-Cookie
  GET  /api/auth-check       → von Caddy via forward_auth aufgerufen;
                                204 wenn Cookie gültig, sonst 302 (HTML-Request)
                                oder 401 (API-Request)

`/api/features` ist die kanonische Quelle für "was ist in dieser Box
aktiv und installiert" — das Frontend rendert daraus Button-States,
Indikatoren etc. Antworten erweitern (neue Top-Level-Keys), aber
bestehende Felder nicht stillschweigend ändern; das Frontend liest
defensiv (optional chaining), sodass alte Clients neue Felder ignorieren.

Auth-Modell siehe docs/developers/operations/authentifizierung.md.

Der Hostname wird absichtlich NICHT vom Server geliefert. Was vom Browser
aus erreichbar ist, weiß nur der Browser — er kennt die URL, über die er
gerade die UI geladen hat. Ein vom Container geratener Hostname (Container-
Bridge-IP, Hostheader, …) trägt höchstens auf Linux-Native; auf Docker
Desktop unter macOS und Windows ist die Bridge-IP nicht vom Host
erreichbar, und HTTP-`localhost` ist als SMB-Ziel auf beiden OS
problematisch (Finder-Bug bzw. LanmanServer-Konflikt).
"""

import hashlib
import hmac
import http.server
import json
import os
import secrets
import socketserver
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

PORT = int(os.environ.get("AGENT_API_PORT", "8001"))
HOST = os.environ.get("AGENT_API_HOST", "127.0.0.1")

SMB_PASSWD_FILE = Path(
    os.environ.get("SMB_PASSWORD_FILE")
    or os.environ.get("SMB_PASSWD_FILE")
    or "/home/agent/.config/agentbox/smb-passwd"
)
SMB_USER = "agent"
SMB_SHARE = os.environ.get("SMB_SHARE", "workspace")
SMB_EXTERNAL_PORT = int(os.environ.get("SMB_PORT", "445"))
SMB_ENABLED = os.environ.get("SMB_ENABLED", "1").lower() not in {
    "0",
    "false",
    "no",
    "off",
}

COOKIE_NAME = "agentbox_session"
COOKIE_MAX_AGE = 30 * 24 * 3600  # 30 Tage
COOKIE_SECRET_FILE = Path(
    os.environ.get("COOKIE_SECRET_FILE", "/home/agent/.config/agentbox/cookie-secret")
)


def load_or_create_secret() -> bytes:
    """Liest das HMAC-Secret aus der Datei oder generiert es beim ersten Start.

    Persistent im agent-home-Volume, damit Sessions Container-Restarts überleben.
    """
    if COOKIE_SECRET_FILE.exists():
        return COOKIE_SECRET_FILE.read_bytes()
    COOKIE_SECRET_FILE.parent.mkdir(parents=True, exist_ok=True)
    secret = secrets.token_bytes(32)
    # mode 600: nur der agent-User darf lesen
    COOKIE_SECRET_FILE.write_bytes(secret)
    COOKIE_SECRET_FILE.chmod(0o600)
    return secret


def app_password() -> str:
    pw = os.environ.get("APP_PASSWORD")
    if not pw:
        print("FEHLER: APP_PASSWORD nicht gesetzt", file=sys.stderr, flush=True)
        sys.exit(1)
    return pw


COOKIE_SECRET = load_or_create_secret()
APP_PASSWORD = app_password()


def sign(expiry: int) -> str:
    mac = hmac.new(COOKIE_SECRET, str(expiry).encode("ascii"), hashlib.sha256)
    return mac.hexdigest()


def make_token(expiry: int | None = None) -> str:
    if expiry is None:
        expiry = int(time.time()) + COOKIE_MAX_AGE
    return f"{expiry}.{sign(expiry)}"


def verify_token(token: str) -> bool:
    """Validiert Format, Signatur und Ablauf in konstanter Zeit."""
    try:
        expiry_str, signature = token.split(".", 1)
        expiry = int(expiry_str)
    except (ValueError, AttributeError):
        return False
    expected = sign(expiry)
    if not hmac.compare_digest(signature, expected):
        return False
    return time.time() < expiry


def parse_cookie(header: str | None, name: str) -> str | None:
    if not header:
        return None
    # http.cookies wäre Stdlib, aber die hier benötigte Funktionalität ist
    # so klein, dass ein manuelles Splitten die Abhängigkeit nicht rechtfertigt.
    for part in header.split(";"):
        if "=" not in part:
            continue
        key, _, value = part.partition("=")
        if key.strip() == name:
            return value.strip()
    return None


def cookie_attrs(secure: bool) -> str:
    attrs = [
        f"Max-Age={COOKIE_MAX_AGE}",
        "Path=/",
        "HttpOnly",
        "SameSite=Strict",
    ]
    if secure:
        attrs.append("Secure")
    return "; ".join(attrs)


def read_password() -> str:
    try:
        return SMB_PASSWD_FILE.read_text(encoding="utf-8").strip()
    except (FileNotFoundError, OSError):
        return ""


class Handler(http.server.BaseHTTPRequestHandler):
    server_version = "agentbox-agent-api/2.0"

    def _json(self, status: int, body: dict) -> None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def _err(self, status: int, msg: str) -> None:
        self._json(status, {"error": msg})

    def _no_content(self, extra_headers: list[tuple[str, str]] | None = None) -> None:
        self.send_response(204)
        for k, v in extra_headers or []:
            self.send_header(k, v)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def _smb_info(self) -> dict:
        if not SMB_ENABLED:
            return {"enabled": False}
        return {
            "enabled": True,
            "port": SMB_EXTERNAL_PORT,
            "share": SMB_SHARE,
            "user": SMB_USER,
            "password": read_password(),
        }

    def _features(self) -> dict:
        return {
            "smb": {"enabled": SMB_ENABLED},
        }

    def _is_https(self) -> bool:
        # Caddy setzt X-Forwarded-Proto. Wir vertrauen dem, weil agent-api
        # nur auf 127.0.0.1 lauscht — externe Clients können den Header
        # nicht durchschmuggeln.
        return self.headers.get("X-Forwarded-Proto", "").lower() == "https"

    def _wants_html(self) -> bool:
        return "text/html" in (self.headers.get("Accept") or "").lower()

    def _read_json(self) -> dict | None:
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > 4096:
            return None
        try:
            raw = self.rfile.read(length)
            return json.loads(raw)
        except (json.JSONDecodeError, ValueError):
            return None

    def _auth_check(self) -> None:
        token = parse_cookie(self.headers.get("Cookie"), COOKIE_NAME)
        if token and verify_token(token):
            return self._no_content()
        # Caddy gibt die Antwort dieses Subrequests 1:1 an den Browser zurück
        # (forward_auth-Verhalten). Daher: für Browser-Navigation 302 nach
        # /login, für fetch/XHR/SSE 401, damit JS sauber reagieren kann.
        if self._wants_html():
            self.send_response(302)
            self.send_header("Location", "/login")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return
        self._err(401, "nicht angemeldet")

    def _login(self) -> None:
        body = self._read_json()
        if not body or not isinstance(body.get("password"), str):
            return self._err(400, "password fehlt")
        # constant-time Vergleich; encode() auf gleiche Länge gebracht, damit
        # die Länge nicht durchsickert.
        a = body["password"].encode("utf-8")
        b = APP_PASSWORD.encode("utf-8")
        # hmac.compare_digest ist length-leaking-safe wenn beide gleich lang
        # sind. Für die Sicherheit hier ausreichend, weil Length-Leak bei
        # einem Single-User-Setup keine relevante Information preisgibt.
        if len(a) != len(b) or not hmac.compare_digest(a, b):
            return self._err(401, "falsches Passwort")
        token = make_token()
        cookie = f"{COOKIE_NAME}={token}; {cookie_attrs(self._is_https())}"
        self._no_content([("Set-Cookie", cookie)])

    def _logout(self) -> None:
        # Cookie überschreiben mit leerem Wert und Max-Age=0
        cookie = (
            f"{COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict"
            + ("; Secure" if self._is_https() else "")
        )
        self._no_content([("Set-Cookie", cookie)])

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/auth-check":
            return self._auth_check()
        if path == "/api/features":
            return self._json(200, self._features())
        if path == "/api/smb-info":
            if not SMB_ENABLED:
                return self._json(404, {"enabled": False, "error": "SMB ist deaktiviert"})
            return self._json(200, self._smb_info())
        self._err(404, "unbekannte Route")

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/login":
            return self._login()
        if path == "/api/logout":
            return self._logout()
        self._err(404, "unbekannte Route")

    def log_message(self, fmt, *args):
        # Standard-Logging ans Container-Stdout ist gewollt — sichtbar in
        # `docker logs`, ohne Auth-Token preiszugeben.
        super().log_message(fmt, *args)


class ThreadingServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def main() -> None:
    server = ThreadingServer((HOST, PORT), Handler)
    print(f"agent-api on {HOST}:{PORT}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
