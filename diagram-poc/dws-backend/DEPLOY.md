# Deploying the Design Workspace backend

Same shape as the block diagram backend: a fat jar on the host, run by systemd.
The two sit side by side — **BLK on 8090, DWS on 8091** — so neither has to move.

| | |
|---|---|
| Host path | `/home/oracle/dws-backend/` |
| Jar | `dws-backend-0.0.1-SNAPSHOT.jar` |
| Service | `dws-backend` |
| Port | `8091` |
| Health | `http://127.0.0.1:8091/actuator/health` |

## One-time setup on the host

```bash
mkdir -p /home/oracle/dws-backend

sudo cp diagram-poc/dws-backend/deploy/dws-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now dws-backend
```

Check `which java` first — the unit hardcodes `/usr/bin/java`. If the JDK lives
elsewhere, change `ExecStart` to match rather than relying on `PATH`: systemd
runs `ExecStart` without a shell and does not read the login profile.

## Every deploy after that

```bash
# 1. build
cd diagram-poc/dws-backend
mvn clean package                       # -> target/dws-backend-0.0.1-SNAPSHOT.jar

# 2. copy the new jar over
scp target/dws-backend-0.0.1-SNAPSHOT.jar \
    oracle@<host>:/home/oracle/dws-backend/dws-backend-0.0.1-SNAPSHOT.jar.new
ssh oracle@<host> 'mv /home/oracle/dws-backend/dws-backend-0.0.1-SNAPSHOT.jar{.new,}'

# 3. restart
sudo systemctl restart dws-backend

# 4. confirm "Active since" is now
systemctl status dws-backend --no-pager | head -5

# 5. watch the logs
journalctl -u dws-backend -f
```

Step 2 uploads beside the live jar and then moves it into place. `scp`
truncates its target as it writes, so copying straight over a running
service's jar leaves a half-written file if the transfer drops — and the
service only finds out at the next restart.

Or do the whole thing in one command:

```bash
./deploy/deploy.sh oracle@<host>
```

which builds (with tests), ships, restarts, prints the status, and then polls
`/actuator/health` until the app is actually serving. A restart that
"succeeded" but left the app failing to start looks identical in
`systemctl status` for about ten seconds — the health check is what tells the
two apart.

## Smoke test

```bash
curl -s http://<host>:8091/actuator/health
# {"status":"UP"}

curl -s "http://<host>:8091/api/sfdc/opportunities/0061t00000AbCdEfGhI/tabs" | jq '.tabs[] | {order, key, badge}'
# 7 tabs, overview first

curl -s -o /dev/null -w '%{http_code}\n' "http://<host>:8091/api/sfdc/opportunities/0061t00000NoSuchId/tabs"
# 404
```

## Rollback

Keep the previous jar and swap it back:

```bash
cd /home/oracle/dws-backend
cp dws-backend-0.0.1-SNAPSHOT.jar dws-backend.previous.jar   # before deploying
# …if the new one misbehaves:
cp dws-backend.previous.jar dws-backend-0.0.1-SNAPSHOT.jar
sudo systemctl restart dws-backend
```

## Configuration

Everything has a working default; override only what a host needs. systemd
reads these from `Environment=` lines in the unit.

| What | Env var | Default |
|---|---|---|
| Port | `PORT`, or `--server.port` | `8091` |
| CORS origin patterns | `DWS_CORS_ALLOWEDORIGINPATTERNS` (comma-separated) | localhost, `*.arrow.com`, the Salesforce hosts |
| Log level | `LOGGING_LEVEL_COM_ARROW_DWS` | `INFO` |

Adding a Salesforce org means adding its origin pattern, then
`sudo systemctl restart dws-backend`.

## Things worth knowing

1. **No database.** The POC serves a fixture from memory
   (`InMemoryDesignRepository`), so there is no volume to mount and nothing to
   back up — a redeploy loses nothing because there is nothing to lose. When
   this grows a real store, that changes and this section needs rewriting.

2. **No authentication.** The endpoint answers anyone who can reach it.
   Deliberate for the POC and fine on an internal host; not fine on anything
   reachable from outside. If it is ever exposed publicly, put it behind the
   reverse proxy with an allowlist first.

3. **`SuccessExitStatus=143` is in the unit on purpose.** A JVM killed by
   SIGTERM exits 143. Without that line every clean stop is recorded as a
   failure and `systemctl status` reads red when nothing is wrong.

4. **Stateless, so more than one instance is fine.** Unlike the block diagram
   backend — whose collaboration sessions live in memory and therefore pin it
   to a single instance — this service holds no per-user state, and can sit
   behind a load balancer as-is.

5. **CORS allows `credentials: false`.** That is what makes the wildcard origin
   patterns safe. If authentication is added later, that pairing has to be
   revisited in the same change.
