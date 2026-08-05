# DrumPath Remote Drum Relay

A local WebSocket relay letting a phone (running DrumPath's touch page)
send drum hits, live, to a desktop browser tab running DrumPath's
`VisualTrainerPage` — so a graded practice session can be played with taps
on the phone instead of the desktop's keyboard. See
`docs/adr/0007-remote-drum-relay-local-lan-boundary.md` in the DrumPath repo
for the architectural boundary this serves.

This is a separate, unrelated service from `server/drum-import-service/` —
same overall shape (own subdirectory, own `requirements.txt`/README, run via
`uvicorn`), different concern.

**Trust model: same LAN, no auth.** There is no pairing code, login, or
encryption — any device on the network can connect as a controller. This is
a deliberate v1 simplification for a personal, single-household practice
tool, not a production service. `ALLOWED_ORIGIN`/CORS below only protects
the plain HTTP health check — Starlette's `CORSMiddleware` does not apply to
WebSocket connections at all, so it provides no actual access control on
`/ws/host` or `/ws/controller`.

## Setup

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Run

```powershell
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

**`--host 0.0.0.0` is required** — unlike `drum-import-service` (which is
only ever called from the desktop's own `localhost`), this relay must
actually be reachable from the phone over the LAN. The default bind
(`127.0.0.1`) will silently make the phone unable to connect at all; this is
the single most likely cause if pairing doesn't work.

Full LAN-reachability checklist:

1. **This relay**: run with `--host 0.0.0.0 --port 8001` as above.
2. **Vite dev server**: `npm run dev -- --host` (plain `npm run dev` also
   defaults to loopback-only, so the phone can't load `touch.html` at all
   without this).
3. **Windows Firewall**: the first time you run step 1 with `--host
   0.0.0.0`, Windows will prompt "Allow this app to communicate on private
   networks" — allow it, or the phone's connection attempts will just hang.
4. **Find the desktop's LAN IP** (what the phone types in): `ipconfig` →
   the `IPv4 Address` under your active adapter (e.g. `192.168.1.59`). The
   phone connects to `ws://<that-ip>:8001/ws/controller`.
5. **Both devices must be on the same LAN/subnet** — same router, whether
   the desktop is on WiFi or Ethernet doesn't matter, only the phone's own
   connection has to be WiFi (it has no cable).
6. **Mixed content**: a plain `ws://` connection can't be opened from a page
   loaded over `https://` — this dev relay (plain HTTP) only works when the
   touch page itself is also loaded over plain `http://` (the LAN dev
   server). The deployed `https://` site uses the separate, always-on
   **production** relay instead — see below — which uses `wss://` and isn't
   affected by this.

Run this alongside DrumPath's own `npm run dev -- --host` (a separate
terminal) — independent processes, same as `drum-import-service`.

## Production (always-on, via the domain)

Unlike the dev workflow above, the production instance doesn't need the
phone to know any LAN address at all — both the desktop and the phone reach
it at the same fixed address, `wss://shilmanlior2608.ddns.net:40001`,
whether at home or away (confirmed: this machine's router does support NAT
hairpin, so the domain resolves and connects correctly even from inside the
house — see ADR 0007 for why an earlier test seemed to say otherwise: that
was a PowerShell certificate-validation quirk, not a real network
limitation).

This only works because the relay terminates TLS itself, directly, using
the exact same certificate IIS already uses across its many bindings —
**not** because it's proxied through IIS (an IIS/ARR reverse-proxy approach
was considered and rejected — see ADR 0007 — because it needs the
currently-disabled Windows "IIS-WebSockets" feature, which would require an
`iisreset` affecting every other project on this shared server).

### One-time setup

```powershell
# From this directory (server/remote-drum-relay):
$pfxPath = "certs\export.pfx"
$password = ConvertTo-SecureString -String "<choose-a-temporary-password>" -Force -AsPlainText
Export-PfxCertificate -Cert "Cert:\LocalMachine\My\9f184b1be17de94755353c996d82a64293151e09" -FilePath $pfxPath -Password $password
```

Then, from Git Bash (or any shell with `openssl` on PATH — on this machine
that's `/mingw64/bin/openssl` via Git for Windows, not plain PowerShell):

```bash
cd server/remote-drum-relay/certs
openssl pkcs12 -in export.pfx -nocerts -nodes -passin pass:<same-password> -out key.pem
openssl pkcs12 -in export.pfx -clcerts -nokeys -passin pass:<same-password> -out cert.pem
rm export.pfx
```

`certs/` is gitignored — `cert.pem`/`key.pem` contain a private key and must
never be committed. Re-run this export if the underlying Windows certificate
is ever renewed/replaced.

### Running it

```powershell
pm2 start ecosystem.config.cjs
pm2 save
```

`pm2 save` persists the process list, but **`pm2 startup` (auto-resurrect on
reboot) is not currently configured on this machine for any app** — after a
reboot, this (and every other pm2-managed process here) needs `pm2 resurrect`
run manually, or `pm2 startup` set up once as a separate, deliberate,
machine-wide decision (it affects every pm2 app on this host, not just this
one).

Verify: `pm2 status` shows `drumpath-remote-relay` running;
`Invoke-WebRequest -SkipCertificateCheck https://localhost:40001/api/v1/health`
(or the real hostname) returns `{"status":"ok",...}`.

Port **40001** is inside the 30000–45000 range already bulk-forwarded on the
router (per the setup used for every other project on this domain) — no
router change should be needed, but worth confirming once live from an
actual external network.

## Protocol

Two WebSocket endpoints, no pairing code — the relay holds at most one
active "host" (desktop) connection at a time; any "controller" (phone) that
connects relays to whichever host is current. If a second desktop tab
connects as host, the first is closed with WS code `4001`
("replaced-by-new-host") — the desktop-side hook treats this specific code
as "don't auto-reconnect" to avoid two open tabs endlessly re-superseding
each other.

- `WS /ws/host` — receives `{"type":"hit","instrument":"<DrumInstrument>"}`
  messages relayed from controllers. Also receives
  `{"type":"controller_status","count":<n>}` whenever a controller
  connects/disconnects.
- `WS /ws/controller` — sends `{"type":"hit","instrument":...}` messages.
  Receives `{"type":"host_status","connected":<bool>}` immediately on
  connect and whenever the host connects/disconnects afterward.
- `GET /api/v1/health` — `{ status, version }`.

`instrument` must be one of the 9 values in
`src/domain/interactive-exercise.ts`'s `drumInstrumentSchema` — mirrored by
hand in `app/schemas.py`'s `DrumInstrument` Literal (same accepted
TS/Python duplication `drum-import-service` already documents for its own
schema). Malformed or invalid messages are silently ignored, never crash
the connection.

No timestamps are sent from the phone — the desktop stamps its own
`performance.now()` the instant it receives a hit, since a phone's clock
isn't synchronized with the desktop's `AudioContext` clock. Network latency
becomes the hit's timing error (tens of ms on a good LAN), which is fine —
no NTP-style clock sync is attempted.

## Tests

```powershell
pytest
```

`tests/test_relay.py` — in-process via Starlette's `TestClient`, no real
sockets or separate server process needed.
