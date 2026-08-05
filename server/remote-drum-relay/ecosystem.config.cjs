// Production instance of the relay — always-on via PM2, own TLS (see
// certs/, exported from the same Windows certificate every other project
// on this machine shares), own port 40001, reachable at
// wss://shilmanlior2608.ddns.net:40001. Separate from the dev workflow
// (run-dev.ps1 / manual `uvicorn --reload --port 8001`, plain HTTP,
// localhost-only) — that one stays for iterating on the code itself. See
// docs/adr/0007-remote-drum-relay-local-lan-boundary.md in the DrumPath
// repo for why a dedicated port + own TLS was chosen over an IIS/ARR
// reverse proxy.
module.exports = {
  apps: [
    {
      name: 'drumpath-remote-relay',
      script: '.venv/Scripts/python.exe',
      args:
        '-m uvicorn app.main:app --host 0.0.0.0 --port 40001 --ssl-keyfile ./certs/key.pem --ssl-certfile ./certs/cert.pem',
      cwd: __dirname,
      env: {
        ALLOWED_ORIGIN: 'https://shilmanlior2608.ddns.net:40000',
      },
    },
  ],
}
