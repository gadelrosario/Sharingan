import importlib.util
import json
import io
import os
import pathlib
import stat
import sys
import tempfile
import unittest
import urllib.parse
import urllib.error
from unittest import mock

ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("yahoo_auth_bridge", ROOT / "api" / "yahoo_auth_bridge.py")
bridge = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
sys.modules[SPEC.name] = bridge
SPEC.loader.exec_module(bridge)


class Response:
    def __init__(self, payload, status=200, raw=False):
        self.payload = payload if raw else json.dumps(payload).encode()
        self.status = status

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def read(self):
        return self.payload


class YahooBridgeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = pathlib.Path(self.temp.name) / "tokens.json"
        self.config = bridge.YahooConfig(
            client_id="test-client",
            client_secret="test-secret",
            redirect_uri="https://localhost:8787/api/yahoo/callback",
            token_store=self.path,
            tls_cert_file=pathlib.Path(self.temp.name) / "local.pem",
            tls_key_file=pathlib.Path(self.temp.name) / "local-key.pem",
        )

    def tearDown(self):
        self.temp.cleanup()

    def test_authorization_url_has_code_flow_and_state(self):
        client = bridge.YahooOAuthClient(self.config, bridge.TokenStore(self.path))
        parsed = urllib.parse.urlsplit(client.authorization_url("csrf-state"))
        query = urllib.parse.parse_qs(parsed.query)
        self.assertEqual(parsed.scheme, "https")
        self.assertEqual(query["response_type"], ["code"])
        self.assertEqual(query["state"], ["csrf-state"])
        self.assertEqual(query["redirect_uri"], [self.config.redirect_uri])
        self.assertEqual(self.config.redirect_uri, "https://localhost:8787/api/yahoo/callback")

    def test_http_redirect_configuration_is_rejected(self):
        insecure = bridge.YahooConfig(
            client_id="client",
            client_secret="secret",
            redirect_uri="http://127.0.0.1:8787/api/yahoo/callback",
        )
        self.assertFalse(insecure.ready)

    def test_environment_defaults_use_exact_https_callback_and_certificate_paths(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            config = bridge.YahooConfig.from_env()
        self.assertEqual(config.redirect_uri, "https://localhost:8787/api/yahoo/callback")
        self.assertEqual(config.tls_cert_file, pathlib.Path(".certs/yahoo-localhost.pem"))
        self.assertEqual(config.tls_key_file, pathlib.Path(".certs/yahoo-localhost-key.pem"))

    def test_tls_context_requires_certificate_and_enforces_tls_1_2(self):
        with self.assertRaises(FileNotFoundError):
            bridge.create_tls_context(self.config)
        self.config.tls_cert_file.write_text("fixture certificate")
        self.config.tls_key_file.write_text("fixture key")
        fake_context = mock.Mock()
        with mock.patch.object(bridge.ssl, "SSLContext", return_value=fake_context):
            context = bridge.create_tls_context(self.config)
        self.assertIs(context, fake_context)
        self.assertEqual(fake_context.minimum_version, bridge.ssl.TLSVersion.TLSv1_2)
        fake_context.load_cert_chain.assert_called_once_with(
            certfile=str(self.config.tls_cert_file), keyfile=str(self.config.tls_key_file)
        )
        source = (ROOT / "api" / "yahoo_auth_bridge.py").read_text()
        self.assertNotIn("_create_unverified_context", source)
        self.assertNotIn("CERT_NONE", source)

    def test_oauth_state_is_single_use_and_expires(self):
        now = [100.0]
        states = bridge.OAuthStateStore(ttl_seconds=10, clock=lambda: now[0])
        value = states.issue()
        self.assertTrue(states.consume(value))
        self.assertFalse(states.consume(value))
        value = states.issue()
        now[0] = 111.0
        self.assertFalse(states.consume(value))

    def test_token_exchange_stores_private_file_without_browser_exposure(self):
        requests = []

        def opener(request, timeout):
            requests.append(request)
            return Response({"access_token": "access", "refresh_token": "refresh", "expires_in": 3600})

        store = bridge.TokenStore(self.path)
        client = bridge.YahooOAuthClient(self.config, store, opener=opener, clock=lambda: 100)
        token = client.exchange_code("authorization-code")
        self.assertEqual(token["expires_at"], 3700)
        self.assertEqual(stat.S_IMODE(self.path.parent.stat().st_mode), 0o700)
        self.assertEqual(stat.S_IMODE(self.path.stat().st_mode), 0o600)
        body = urllib.parse.parse_qs(requests[0].data.decode())
        self.assertEqual(body["grant_type"], ["authorization_code"])
        self.assertEqual(body["code"], ["authorization-code"])
        self.assertEqual(body["redirect_uri"], [self.config.redirect_uri])
        self.assertEqual(
            requests[0].headers["Authorization"],
            "Basic " + bridge.base64.b64encode(b"test-client:test-secret").decode(),
        )
        self.assertEqual(requests[0].headers["Content-type"], "application/x-www-form-urlencoded")
        self.assertNotIn("test-secret", (ROOT / "js" / "yahoo-sync-v1.js").read_text())

    def test_successful_exchange_verifies_access_and_latest_refresh_persistence(self):
        logs = []
        store = bridge.TokenStore(self.path)
        client = bridge.YahooOAuthClient(
            self.config,
            store,
            opener=lambda request, timeout: Response({"access_token": "new-access", "refresh_token": "latest-refresh", "expires_in": 3600}),
            logger=logs.append,
        )
        client.exchange_code("authorization-code")
        saved = store.read()
        self.assertEqual(saved["access_token"], "new-access")
        self.assertEqual(saved["refresh_token"], "latest-refresh")
        diagnostic = "\n".join(logs)
        self.assertIn("token_persisted", diagnostic)
        self.assertIn("access_token_present=true", diagnostic)
        self.assertIn("refresh_token_present=true", diagnostic)
        self.assertIn("latest_refresh_token_persisted=true", diagnostic)
        self.assertNotIn("new-access", diagnostic)
        self.assertNotIn("latest-refresh", diagnostic)

    def test_safe_token_error_diagnostic_reports_status_and_yahoo_error_only(self):
        logs = []
        live_code = "LIVE-AUTHORIZATION-CODE-NEVER-LOG"

        def opener(request, timeout):
            body = json.dumps({
                "error": "invalid_grant",
                "error_description": (
                    f"Authorization code={live_code} rejected for client test-client "
                    "using secret test-secret; access_token=LEAK and refresh_token=LEAK2"
                ),
            }).encode()
            raise urllib.error.HTTPError(request.full_url, 400, "Bad Request", {}, io.BytesIO(body))

        client = bridge.YahooOAuthClient(
            self.config,
            bridge.TokenStore(self.path),
            opener=opener,
            logger=logs.append,
        )
        with self.assertRaisesRegex(RuntimeError, r"400, invalid_grant"):
            client.exchange_code(live_code)
        diagnostic = "\n".join(logs)
        self.assertIn("token_request", diagnostic)
        self.assertIn("client_id_configured=true", diagnostic)
        self.assertIn("authentication_method=client_secret_basic", diagnostic)
        self.assertIn("grant_type=authorization_code", diagnostic)
        self.assertIn("authorization_code_present=true", diagnostic)
        self.assertIn(f"redirect_uri={self.config.redirect_uri}", diagnostic)
        self.assertIn("redirect_uri_matches_config=true", diagnostic)
        self.assertIn("http_status=400", diagnostic)
        self.assertIn("error=invalid_grant", diagnostic)
        self.assertIn("error_description=", diagnostic)
        for secret in (live_code, "test-client", "test-secret", "LEAK", "LEAK2"):
            self.assertNotIn(secret, diagnostic)

    def test_authorization_diagnostic_uses_exact_redirect_without_state_value(self):
        logs = []
        client = bridge.YahooOAuthClient(
            self.config,
            bridge.TokenStore(self.path),
            logger=logs.append,
        )
        client.authorization_url("STATE-NEVER-LOG")
        diagnostic = "\n".join(logs)
        self.assertIn(f"redirect_uri={self.config.redirect_uri}", diagnostic)
        self.assertIn("state_present=true", diagnostic)
        self.assertNotIn("STATE-NEVER-LOG", diagnostic)
        self.assertNotIn("test-client", diagnostic)

    def test_http_access_log_never_includes_callback_query(self):
        store = bridge.TokenStore(self.path)
        oauth = bridge.YahooOAuthClient(self.config, store, logger=lambda _: None)
        handler_type = bridge.make_handler(
            self.config,
            oauth,
            bridge.YahooFantasyClient(oauth),
            bridge.OAuthStateStore(),
        )
        handler = object.__new__(handler_type)
        handler.path = "/api/yahoo/callback?code=CODE-NEVER-LOG&state=STATE-NEVER-LOG"
        handler.command = "GET"
        handler.log_date_time_string = lambda: "timestamp"
        with mock.patch("builtins.print") as printer:
            handler.log_message('ignored')
        rendered = " ".join(str(arg) for call in printer.call_args_list for arg in call.args)
        self.assertIn("GET /api/yahoo/callback", rendered)
        self.assertNotIn("CODE-NEVER-LOG", rendered)
        self.assertNotIn("STATE-NEVER-LOG", rendered)

    def test_expired_access_token_refreshes_and_keeps_latest_refresh_token(self):
        store = bridge.TokenStore(self.path)
        store.write({"access_token": "old", "refresh_token": "old-refresh", "expires_at": 1})

        def opener(request, timeout):
            return Response({"access_token": "new", "refresh_token": "rotated", "expires_in": 3600})

        client = bridge.YahooOAuthClient(self.config, store, opener=opener, clock=lambda: 100)
        self.assertEqual(client.access_token(), "new")
        self.assertEqual(store.read()["refresh_token"], "rotated")

    def test_missing_refresh_token_requires_reconnect(self):
        store = bridge.TokenStore(self.path)
        store.write({"access_token": "old", "expires_at": 1})
        client = bridge.YahooOAuthClient(self.config, store, clock=lambda: 100)
        with self.assertRaises(PermissionError):
            client.access_token()

    def test_fantasy_requests_use_bearer_and_json(self):
        seen = []

        class OAuth:
            @staticmethod
            def access_token():
                return "access"

        def opener(request, timeout):
            seen.append(request)
            return Response({"fantasy_content": {}})

        client = bridge.YahooFantasyClient(OAuth(), opener=opener)
        client.discover_leagues(2026)
        self.assertEqual(seen[0].headers["Authorization"], "Bearer access")
        self.assertEqual(seen[0].method, "GET")
        self.assertIn("format=json", seen[0].full_url)
        self.assertIn("users;use_login=1/games;game_keys=nfl/leagues", seen[0].full_url)
        self.assertNotIn("seasons=", seen[0].full_url)

    def test_401_is_invalid_or_expired_and_preserves_token_for_diagnosis(self):
        store = bridge.TokenStore(self.path)
        store.write({"access_token": "revoked", "refresh_token": "revoked", "expires_at": 9999})

        class OAuth:
            def __init__(self, token_store):
                self.store = token_store

            @staticmethod
            def access_token():
                return "revoked"

        def opener(request, timeout):
            body = json.dumps({"error": {"code": "token_rejected", "description": "Access token expired"}}).encode()
            raise urllib.error.HTTPError(request.full_url, 401, "Unauthorized", {}, io.BytesIO(body))

        client = bridge.YahooFantasyClient(OAuth(store), opener=opener)
        with self.assertRaises(bridge.YahooFantasyRequestError) as raised:
            client.get("users;use_login=1")
        self.assertEqual(raised.exception.classification, "INVALID_OR_EXPIRED_TOKEN")
        self.assertTrue(raised.exception.reconnect_required)
        self.assertIsNotNone(store.read())

    def test_fantasy_diagnostics_are_secret_safe_and_classify_statuses(self):
        cases = (
            (403, "INSUFFICIENT_FANTASY_PERMISSION", False),
            (404, "MALFORMED_OR_UNSUPPORTED_ENDPOINT", False),
        )
        for status, classification, reconnect in cases:
            with self.subTest(status=status):
                logs = []

                class OAuth:
                    logger = logs.append
                    @staticmethod
                    def access_token_with_metadata():
                        return "ACCESS-NEVER-LOG", {
                            "access_token_present": True, "token_age_seconds": 42,
                            "expires_in_seconds": 3558, "expiry_state": "fresh", "refresh_attempted": False,
                        }

                def opener(request, timeout):
                    body = json.dumps({"fantasy_content": {"error": {
                        "code": "permission_denied",
                        "description": "Denied access_token=ACCESS-NEVER-LOG authorization=Bearer-NEVER-LOG",
                    }}}).encode()
                    raise urllib.error.HTTPError(request.full_url, status, "Rejected", {}, io.BytesIO(body))

                client = bridge.YahooFantasyClient(OAuth(), opener=opener, logger=logs.append)
                with self.assertRaises(bridge.YahooFantasyRequestError) as raised:
                    client.discover_leagues(2026)
                self.assertEqual(raised.exception.classification, classification)
                self.assertEqual(raised.exception.reconnect_required, reconnect)
                diagnostic = "\n".join(logs)
                self.assertIn("endpoint=https://fantasysports.yahooapis.com/fantasy/v2", diagnostic)
                self.assertIn("resource=users;use_login=1/games;game_keys=nfl/leagues", diagnostic)
                self.assertIn("method=GET", diagnostic)
                self.assertIn(f"http_status={status}", diagnostic)
                self.assertIn(f"classification={classification}", diagnostic)
                self.assertIn("access_token_present=true", diagnostic)
                self.assertIn("token_age_seconds=42", diagnostic)
                self.assertIn("expiry_state=fresh", diagnostic)
                self.assertIn("refresh_attempted=false", diagnostic)
                self.assertIn("yahoo_error_code=permission_denied", diagnostic)
                self.assertNotIn("ACCESS-NEVER-LOG", diagnostic)
                self.assertNotIn("Bearer-NEVER-LOG", diagnostic)
                self.assertNotIn("Authorization:", diagnostic)

    def test_network_and_parser_failures_are_distinct(self):
        class OAuth:
            @staticmethod
            def access_token_with_metadata():
                return "access", {"access_token_present": True, "token_age_seconds": 5,
                                  "expires_in_seconds": 1000, "expiry_state": "fresh", "refresh_attempted": False}

        network = bridge.YahooFantasyClient(OAuth(), opener=lambda request, timeout: (_ for _ in ()).throw(urllib.error.URLError("offline")), logger=lambda _: None)
        with self.assertRaises(bridge.YahooFantasyRequestError) as raised:
            network.discover_leagues()
        self.assertEqual(raised.exception.classification, "NETWORK_FAILURE")

        parser = bridge.YahooFantasyClient(OAuth(), opener=lambda request, timeout: Response(b"not-json", raw=True), logger=lambda _: None)
        with self.assertRaises(bridge.YahooFantasyRequestError) as raised:
            parser.discover_leagues()
        self.assertEqual(raised.exception.classification, "PARSER_RESPONSE_SHAPE_FAILURE")

    def test_token_metadata_reports_age_expiry_and_refresh_attempt(self):
        store = bridge.TokenStore(self.path)
        store.write({"access_token": "current", "refresh_token": "refresh", "obtained_at": 90, "expires_at": 200})
        client = bridge.YahooOAuthClient(self.config, store, clock=lambda: 100, logger=lambda _: None)
        _, metadata = client.access_token_with_metadata()
        self.assertEqual(metadata["token_age_seconds"], 10)
        self.assertEqual(metadata["expiry_state"], "fresh")
        self.assertFalse(metadata["refresh_attempted"])

        store.write({"access_token": "old", "refresh_token": "refresh", "obtained_at": 1, "expires_at": 2})
        client = bridge.YahooOAuthClient(
            self.config, store, clock=lambda: 100, logger=lambda _: None,
            opener=lambda request, timeout: Response({"access_token": "new", "refresh_token": "latest", "expires_in": 3600}),
        )
        _, metadata = client.access_token_with_metadata()
        self.assertTrue(metadata["refresh_attempted"])
        self.assertEqual(store.read()["refresh_token"], "latest")

    def test_disconnect_clears_only_explicit_token_store(self):
        store = bridge.TokenStore(self.path)
        store.write({"access_token": "a"})
        neighboring = pathlib.Path(self.temp.name) / "snapshot.json"
        neighboring.write_text('{"kept":true}')
        store.clear()
        self.assertFalse(self.path.exists())
        self.assertTrue(neighboring.exists())

    def test_env_example_contains_no_credentials(self):
        env = (ROOT / ".env.example").read_text()
        self.assertIn("YAHOO_CLIENT_ID=\n", env)
        self.assertIn("YAHOO_CLIENT_SECRET=\n", env)
        self.assertIn("YAHOO_REDIRECT_URI=https://localhost:8787/api/yahoo/callback", env)
        self.assertIn("YAHOO_TLS_CERT_FILE=.certs/yahoo-localhost.pem", env)
        self.assertNotIn("test-secret", env)


if __name__ == "__main__":
    unittest.main()
