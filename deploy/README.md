# Deploy — labourhelpmb.ca

Production runs on a single DigitalOcean droplet. The site image is built in
GitHub Actions, pushed to `ghcr.io/ctataryn/labourhelp-site`, and pulled by the
droplet on every push to `main`.

```
Internet ─► HAProxy container (:80, :443, TLS termination)
              │  HTTP  → 301 → HTTPS  (except /.well-known/acme-challenge/*)
              └─►  site container (nginx:alpine, :80)
                     └─ /.well-known/ comes from a host-mounted webroot
                        used by certbot's HTTP-01 renewals
```

## One-time droplet bootstrap

Do this once, before merging anything to `main`.

### 1. Create the droplet

DigitalOcean → Ubuntu 24.04 LTS → `s-1vcpu-1gb` (~$6/mo). Pick a region
close to your users (TOR1 / NYC). Add your personal SSH key at create time.

### 2. DNS

At your registrar for `labourhelpmb.ca`:

```
A    @    <droplet-ipv4>
AAAA @    <droplet-ipv6>     # optional
```

Wait for propagation (`dig +short labourhelpmb.ca`).

### 3. Harden + install Docker (as root, over SSH)

```bash
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy

mkdir -p /home/deploy/.ssh && chmod 700 /home/deploy/.ssh
# paste the *deploy* public key (generated in step 4) into authorized_keys:
nano /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy

apt-get update && apt-get install -y certbot

mkdir -p /opt/labourhelp/{certs,letsencrypt,webroot/.well-known/acme-challenge}
chown -R deploy:deploy /opt/labourhelp
```

### 4. Generate the deploy SSH key (on your laptop)

This is a *separate* key from your personal one — it lives in GitHub secrets
and is only used by the deploy workflow.

```bash
ssh-keygen -t ed25519 -f ~/.ssh/labourhelp_deploy -N "" -C "gh-actions@labourhelp"
ssh-copy-id -i ~/.ssh/labourhelp_deploy.pub deploy@<droplet-ip>
```

In GitHub → repo → Settings → Secrets and variables → Actions, add:

| Tab           | Name              | Value                                                       |
| ------------- | ----------------- | ----------------------------------------------------------- |
| **Variables** | `DROPLET_HOST`    | droplet IP or hostname                                      |
| **Variables** | `DROPLET_USER`    | `deploy`                                                    |
| **Secrets**   | `DROPLET_SSH_KEY` | contents of `~/.ssh/labourhelp_deploy` (the **private** key) |

Host and user go under the **Variables** tab (they're not sensitive — the IP
is public via DNS, the username is generic). The SSH key goes under
**Secrets** so its value is encrypted and masked in workflow logs.

### 5. Issue the initial Let's Encrypt cert

Standalone mode — runs once before HAProxy is up. Port 80 must be free.

```bash
sudo certbot certonly --standalone \
  -d labourhelpmb.ca \
  --email craig@grindsoftware.com --agree-tos --no-eff-email \
  --config-dir /opt/labourhelp/letsencrypt \
  --work-dir /opt/labourhelp/letsencrypt-work \
  --logs-dir /opt/labourhelp/letsencrypt-log

sudo cat /opt/labourhelp/letsencrypt/live/labourhelpmb.ca/fullchain.pem \
        /opt/labourhelp/letsencrypt/live/labourhelpmb.ca/privkey.pem \
  | sudo tee /opt/labourhelp/certs/labourhelpmb.ca.pem > /dev/null
sudo chmod 600 /opt/labourhelp/certs/labourhelpmb.ca.pem
sudo chown deploy:deploy /opt/labourhelp/certs/labourhelpmb.ca.pem
```

### 6. Set up automatic renewal

Renewals use webroot mode. HAProxy bypasses the HTTPS redirect for the ACME
path and forwards it to the site container, which serves files from
`/opt/labourhelp/webroot/.well-known/acme-challenge/`.

The renewal logic lives in [`renew-cert.sh`](renew-cert.sh). The deploy
workflow copies it to `/opt/labourhelp/` and (re)installs a daily entry in the
**`deploy` user's crontab** on every deploy — no manual cron setup needed.

It runs as `deploy`, not root, so hand the certbot directories (created by the
`sudo certbot` in step 5) over to that user:

```bash
sudo chown -R deploy:deploy /opt/labourhelp/letsencrypt \
  /opt/labourhelp/letsencrypt-work /opt/labourhelp/letsencrypt-log
```

Optional but recommended: create a free check at
[healthchecks.io](https://healthchecks.io) with a 1-day period, and put its
ping URL in `/opt/labourhelp/renew-cert.env`:

```bash
HEALTHCHECK_URL=https://hc-ping.com/<uuid>
```

You'll then get an email if the renewal job fails *or* stops running at all.
Independently, the `TLS cert check` GitHub workflow checks the live cert daily
and fails if it's within 21 days of expiry. (Let's Encrypt no longer sends
expiry reminder emails, so don't rely on those.)

> **Migrating from the old setup:** delete `/etc/cron.d/labourhelp-certbot`
> if it exists (`sudo rm /etc/cron.d/labourhelp-certbot`). Its multi-line
> entry never worked — cron doesn't support `\` line continuations.

### 7. First deploy

Push (or merge a PR) to `main`. The workflow will:

1. build the image and push `ghcr.io/ctataryn/labourhelp-site:sha-<short>` + `:latest`
2. scp `docker-compose.yml`, `haproxy.cfg` and `renew-cert.sh` into `/opt/labourhelp/`
3. install/refresh the cert renewal entry in the `deploy` user's crontab
4. SSH in and run `docker compose pull && docker compose up -d`

Verify:

```bash
curl -I http://labourhelpmb.ca/    # 301 → https
curl -I https://labourhelpmb.ca/   # 200, served by nginx, valid LE cert
```

### 8. Verify the renewal pipeline (after first deploy)

Now that HAProxy + site are up, dry-run the renewal flow end-to-end. This
won't issue a real cert — it just runs the full HTTP-01 challenge against
Let's Encrypt's staging endpoint to prove your droplet can serve the
`/.well-known/acme-challenge/` path:

Run these as `deploy`, **not** with `sudo` — running certbot as root leaves
root-owned files behind that break the cron job.

```bash
certbot renew --dry-run --webroot -w /opt/labourhelp/webroot \
  --config-dir /opt/labourhelp/letsencrypt \
  --work-dir /opt/labourhelp/letsencrypt-work \
  --logs-dir /opt/labourhelp/letsencrypt-log
```

Expect: `Congratulations, all simulated renewals succeeded`. If it fails
with "Connection refused" the stack isn't running; with a 404, the site
container's `.well-known` mount isn't wired up correctly.

## Operations

### Rollback

In the GitHub Actions UI, find an older successful workflow run and click
"Re-run all jobs" — that reuses its build SHA tag. Or, on the droplet:

```bash
cd /opt/labourhelp
IMAGE_TAG=sha-<old-short-sha> docker compose up -d
```

### Tail logs

```bash
docker logs -f labourhelp-site
docker logs -f labourhelp-haproxy
```

### Check cert status

```bash
# all as deploy, no sudo
certbot certificates --config-dir /opt/labourhelp/letsencrypt \
  --work-dir /opt/labourhelp/letsencrypt-work --logs-dir /opt/labourhelp/letsencrypt-log
crontab -l
tail -n 50 /opt/labourhelp/letsencrypt-log/renew-cron.log
sh /opt/labourhelp/renew-cert.sh                   # run a renewal check now
echo | openssl s_client -connect labourhelpmb.ca:443 -servername labourhelpmb.ca 2>/dev/null \
  | openssl x509 -noout -enddate   # what HAProxy is actually serving
```

### Force cert renewal

As `deploy` (no sudo):

```bash
certbot renew --force-renewal --webroot -w /opt/labourhelp/webroot \
  --config-dir /opt/labourhelp/letsencrypt \
  --work-dir /opt/labourhelp/letsencrypt-work \
  --logs-dir /opt/labourhelp/letsencrypt-log \
  --deploy-hook "cat /opt/labourhelp/letsencrypt/live/labourhelpmb.ca/fullchain.pem /opt/labourhelp/letsencrypt/live/labourhelpmb.ca/privkey.pem > /opt/labourhelp/certs/labourhelpmb.ca.pem && docker kill -s HUP labourhelp-haproxy"
```
