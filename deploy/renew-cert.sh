#!/bin/sh
# Renew the labourhelpmb.ca Let's Encrypt cert and hand it to HAProxy.
#
# Copied to /opt/labourhelp/ and scheduled in the deploy user's crontab by the
# deploy workflow. certbot only renews when the cert is within 30 days of
# expiry, so running it every day is cheap and safe.
#
# Optional: set HEALTHCHECK_URL in /opt/labourhelp/renew-cert.env to ping a
# dead-man's-switch service (e.g. healthchecks.io) on success, and
# HEALTHCHECK_URL/fail on failure.
set -eu

PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
BASE=/opt/labourhelp
DOMAIN=labourhelpmb.ca
LE="$BASE/letsencrypt"

[ -r "$BASE/renew-cert.env" ] && . "$BASE/renew-cert.env"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-}"

ping_hc() {
  [ -n "$HEALTHCHECK_URL" ] && curl -fsS -m 10 --retry 3 "$HEALTHCHECK_URL$1" > /dev/null || true
}

trap 'ping_hc /fail' EXIT

# certbot needs write access to all of these; if an earlier `sudo certbot`
# left any root-owned, fail with the fix rather than a cryptic lock error.
for d in "$LE" "$BASE/letsencrypt-work" "$BASE/letsencrypt-log" "$BASE/certs"; do
  if [ -n "$(find "$d" ! -user "$(id -un)" -print -quit 2>/dev/null)" ] || [ ! -w "$d" ]; then
    echo "error: $d (or something in it) is not owned by $(id -un). Fix with:" >&2
    echo "  sudo chown -R $(id -un):$(id -gn) $LE $BASE/letsencrypt-work $BASE/letsencrypt-log $BASE/certs" >&2
    exit 1
  fi
done

certbot renew --quiet \
  --webroot -w "$BASE/webroot" \
  --config-dir "$LE" \
  --work-dir "$BASE/letsencrypt-work" \
  --logs-dir "$BASE/letsencrypt-log" \
  --deploy-hook "cat $LE/live/$DOMAIN/fullchain.pem $LE/live/$DOMAIN/privkey.pem > $BASE/certs/$DOMAIN.pem && docker kill -s HUP labourhelp-haproxy"

trap - EXIT
ping_hc ""
