# Yahoo Sync Foundation — Jōnin 4.4.0

Fantasy HQ treats a completed draft archive as immutable history and Yahoo as the current season truth layer. A Yahoo sync never rewrites a draft archive or makes draft recommendations.

## Official Yahoo findings

- Register an application in the [Yahoo Developer Network](https://developer.yahoo.com/apps/) and select **Fantasy Sports — Read** access.
- Yahoo's [OAuth 2.0 guide](https://developer.yahoo.com/oauth2/guide/) identifies the Authorization Code Grant as the supported server-side grant. Yahoo's current OAuth error contract rejects OAuth over HTTP (`UNSUPPORTED_OVER_HTTP`), so the local callback is HTTPS.
- Authorization starts at `https://api.login.yahoo.com/oauth2/request_auth`; code exchange and refresh use `https://api.login.yahoo.com/oauth2/get_token`, per the [authorization-code flow](https://developer.yahoo.com/oauth2/guide/flows_authcode/).
- API calls use HTTPS and a bearer token in the `Authorization` header, following Yahoo's [API request guidance](https://developer.yahoo.com/oauth2/guide/apirequests/).
- Yahoo documents one-hour access tokens. Refresh tokens may rotate, so Fantasy HQ atomically preserves the latest returned refresh token. Password changes or revocation can require reconnection, per Yahoo's [OAuth FAQ](https://developer.yahoo.com/oauth2/guide/faq/).
- Fantasy data uses the authenticated collections/resources in the [Fantasy Sports API guide](https://developer.yahoo.com/fantasysports/guide/) and requests JSON with `format=json`.

Yahoo's Fantasy guide contains some legacy OAuth 1.0 examples alongside the current resource model, and the official material does not publish a precise current rate-limit quota. Fantasy HQ isolates endpoint construction behind one adapter, caches successful snapshots, uses bounded manual syncs, and does not poll. Exact live response shapes and quotas remain a live-auth verification item.

## Security boundary

```text
Browser Fantasy HQ
        ↓  normalized JSON only
Local HTTPS Yahoo bridge (localhost:8787)
        ↓  OAuth tokens stay here
Yahoo OAuth + Fantasy Sports API
```

The client secret, authorization code, access token, and refresh token never enter browser JavaScript or localStorage. The bridge writes its token envelope atomically to `~/.fantasyhq/yahoo_tokens.json` by default with mode `0600`. `YAHOO_TOKEN_STORE` may select another path outside the repository. Logs omit callback query strings and token bodies.

Normalized, non-secret snapshots live per stable profile at `fantasyHQ.leagueProfile.<profileId>.yahooSeason.v1`. A failed refresh marks cached state stale without clearing the last successful snapshot. **Disconnect Yahoo** explicitly removes the local token file but preserves mappings and snapshots.

## Exact Yahoo redirect URI

Register this exact value in Yahoo Developer Network and use the identical value in `.env`:

```text
https://localhost:8787/api/yahoo/callback
```

Do not substitute `http`, `127.0.0.1`, a different port, or a trailing slash in only one location. Yahoo compares the authorization and token-exchange redirect URI exactly.

## macOS trusted local certificate setup

The bridge terminates TLS itself. The recommended local-development path uses `mkcert`, which creates a local development CA and installs it in the macOS trust store. From the repository root, run:

```bash
brew install mkcert
mkcert -install
mkdir -p .certs
mkcert \
  -cert-file .certs/yahoo-localhost.pem \
  -key-file .certs/yahoo-localhost-key.pem \
  localhost 127.0.0.1 ::1
chmod 600 .certs/yahoo-localhost-key.pem
```

Both `.certs/` and `.env` are excluded from Git. Never commit the generated private key. `mkcert -install` may prompt for the macOS administrator password because it adds the local CA to the System keychain. It does not disable TLS verification.

The bridge refuses to start if the certificate/key is missing, the redirect URI is not HTTPS, or the certificate cannot be loaded. It requires TLS 1.2 or newer. Outbound Yahoo OAuth and Fantasy API requests continue using Python's normal verified HTTPS trust path; no unverified SSL context is used.

### Secret-safe live OAuth diagnostics

On authorization and token exchange, Terminal reports only an allowlisted diagnostic shape:

```text
[Yahoo OAuth] authorization_request client_id_configured=true redirect_uri=https://localhost:8787/api/yahoo/callback response_type=code state_present=true
[Yahoo OAuth] token_request endpoint=https://api.login.yahoo.com/oauth2/get_token client_id_configured=true authentication_method=client_secret_basic grant_type=authorization_code authorization_code_present=true redirect_uri=https://localhost:8787/api/yahoo/callback redirect_uri_matches_config=true
[Yahoo OAuth] token_response http_status=400 error=invalid_grant error_description=<Yahoo's redacted description>
```

The callback query string, state value, authorization code, full Client ID, Client Secret, access token, and refresh token are never logged. Known sensitive values and token-like key/value text in Yahoo error descriptions are replaced with `[REDACTED]` and descriptions are length-limited.

The first Fantasy Sports request logs only the API root/resource, method, HTTP status,
Yahoo's structured error code/message (redacted), access-token presence, token age/expiry
state, and whether refresh was attempted. A 401 is classified as an invalid/expired
token, a 403 as insufficient Fantasy Sports access, supported endpoint failures as a
malformed/unsupported resource, network errors separately, and invalid response JSON
as a parser/response-shape failure. Diagnostic failures preserve the private token
store; only **Disconnect Yahoo** removes it.

## Local setup

1. Create a server-side Yahoo application with Fantasy Sports **Read** permission.
2. Register exactly `https://localhost:8787/api/yahoo/callback` as the Yahoo Redirect URI.
3. Run the macOS certificate commands above.
4. Copy `.env.example` to `.env`, enter the client ID and secret locally, and leave these values unchanged:

   ```text
   YAHOO_REDIRECT_URI=https://localhost:8787/api/yahoo/callback
   YAHOO_TLS_CERT_FILE=.certs/yahoo-localhost.pem
   YAHOO_TLS_KEY_FILE=.certs/yahoo-localhost-key.pem
   ```

5. Start the app with `python3 -m http.server 8000`.
6. In another terminal run `python3 api/yahoo_auth_bridge.py --host 127.0.0.1 --port 8787 --env-file .env`.
7. Open `http://127.0.0.1:8000`, select the intended Fantasy HQ profile, then choose **Connect Yahoo**. The browser connects to the trusted local bridge at `https://localhost:8787`.
8. Choose **Find 2026 Leagues**, choose the correct league, and explicitly **Confirm Mapping**. Display-name guessing is never used.
9. Choose **Sync Now**.

## Read-only resources and fail-soft behavior

The bounded adapter retrieves the authenticated user's 2026 NFL leagues, league metadata/settings, every team and roster, three available-player pages, recent transactions, standings, and scoreboard/matchups. Subsystems fail independently. Successful collections and the last valid snapshot survive a partial or total refresh failure.

No Yahoo mutation endpoint exists. The bridge cannot add/drop, submit waivers, trade, change lineups/settings, alter rosters, or delete Yahoo data.

## Identity, ownership, and draft linkage

Player reconciliation uses stable Yahoo external ID, then exact normalized name plus position, then an explicitly reviewed alias. Everything else remains `AMBIGUOUS` or `UNRESOLVED`. Source team and canonical team remain separate. Duplicate ownership fails the ownership subsystem closed.

Archive linkage requires the stable Fantasy HQ profile, a completed live/Yahoo origin, team count when available, and user draft slot when available. Multiple candidates require review. Linkage cannot mutate an archive. Roster delta reports retained, no-longer-rostered, and acquired-after-draft membership only; it does not invent transaction causes.

## Validation

```bash
python3 -m unittest tests.test_yahoo_auth_bridge tests.test_yahoo_sync_4_4_0
node scripts/run_yahoo_sync_smoke_4_4_0.js
```

Mock validation proves the architecture, not live Yahoo behavior. Live verification requires the user's own OAuth environment and confirmation of league, roster, identity, ownership, transaction, standings, and matchup results.
