#!/usr/bin/env bash
#
# Build, ship and restart the Design Workspace backend.
#
#   ./deploy/deploy.sh oracle@dev-host
#
# Does the same four steps you would do by hand, and then checks the thing is
# actually serving — a restart that "succeeded" but left the app failing to
# start looks identical in systemctl for about ten seconds.

set -euo pipefail

TARGET="${1:-}"
if [[ -z "$TARGET" ]]; then
  echo "usage: $0 user@host [remote-dir] [port]" >&2
  exit 2
fi
REMOTE_DIR="${2:-/home/oracle/dws-backend}"
PORT="${3:-8091}"
JAR="dws-backend-0.0.1-SNAPSHOT.jar"

cd "$(dirname "$0")/.."

echo "==> Building (tests included — a deploy is a bad time to find out)"
mvn -q clean package

echo "==> Shipping target/$JAR to $TARGET:$REMOTE_DIR/"
ssh "$TARGET" "mkdir -p '$REMOTE_DIR'"
# Upload beside the live jar, then move into place: scp truncates the target as
# it writes, so copying straight over a running service's jar can leave a
# half-written file if the transfer drops.
scp "target/$JAR" "$TARGET:$REMOTE_DIR/$JAR.new"
ssh "$TARGET" "mv '$REMOTE_DIR/$JAR.new' '$REMOTE_DIR/$JAR'"

echo "==> Restarting"
ssh "$TARGET" "sudo systemctl restart dws-backend"

echo "==> Status"
ssh "$TARGET" "systemctl status dws-backend --no-pager | head -5"

echo "==> Waiting for health"
for _ in $(seq 1 30); do
  if ssh "$TARGET" "curl -sf http://127.0.0.1:$PORT/actuator/health" >/dev/null 2>&1; then
    echo "    healthy"
    ssh "$TARGET" "curl -s http://127.0.0.1:$PORT/api/sfdc/opportunities/0061t00000AbCdEfGhI/tabs \
      | head -c 120; echo"
    exit 0
  fi
  sleep 2
done

echo "!! Not healthy after 60s. Recent log:" >&2
ssh "$TARGET" "journalctl -u dws-backend -n 40 --no-pager" >&2
exit 1
