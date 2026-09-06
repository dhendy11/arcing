# Kick-off checklist

Everything here is a human step or a step that touches the box. The build
tasks under `.superpowers/sdd/` never do any of it, and none of them ran any
of these commands.

The app name is resolved: `arcing`, everywhere (repo, hostname, systemd unit,
deploy paths). The repo already exists at `github.com/dhendy11/arcing` with
`main` pushed, so there is no repo-creation step here.

## 1. If the name changes later

If a different final name gets chosen after all, rename everything in one
pass before shipping further:

    NAME=<the chosen name>
    grep -rl arcing . --exclude-dir=node_modules --exclude-dir=.git \
      | xargs sed -i '' "s/arcing/$NAME/g"
    git mv deploy/arcing.service "deploy/$NAME.service"
    git mv deploy/Caddyfile.arcing "deploy/Caddyfile.$NAME"
    grep -rn arcing . --exclude-dir=node_modules --exclude-dir=.git

The last command must print nothing. `APP_PASSWORD_HASH` and `APP_E2E_AUTH`
are environment variable names, not placeholders, and this replace does not
touch them. A rename also means renaming the GitHub repo and every path
below that says `arcing`.

## 2. DNS at Porkbun

Add an A record: `arcing.bushidoacquisitions.com` to `155.138.231.13`.
Porkbun is the registrar and the DNS host for bushidoacquisitions.com. This
record may not exist yet. Until it resolves, verify the app is actually
serving by hitting the box over loopback instead of the hostname:

    ssh -i ~/.ssh/vultr_box root@155.138.231.13 "curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3006/login"

## 3. Confirm port 3006 is still free

Confirmed free on the box during planning (2026-09-05): 3001 carnet, 3002
skidmarks, 3003 suke, 3004 banso, 3005 madori are taken; 3006 is open.
Recheck before install, since time has passed:

    ssh -i ~/.ssh/vultr_box root@155.138.231.13 "ss -ltnp | grep ':3006' || echo 'free'"

Expected: `free`.

## 4. Read the sudoers deploy line, then EXTEND it

Confirmed this session: `/etc/sudoers.d/deploy-restart` is one line:

    deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart carnet, /usr/bin/systemctl restart skidmarks, /usr/bin/systemctl restart suke, /usr/bin/systemctl restart madori

It must become this, extended, never replaced (edit with `visudo -f
/etc/sudoers.d/deploy-restart` so a syntax error cannot lock out sudo):

    deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart carnet, /usr/bin/systemctl restart skidmarks, /usr/bin/systemctl restart suke, /usr/bin/systemctl restart madori, /usr/bin/systemctl restart arcing

Re-read the line before trusting the above; it may have changed since this
session. Then confirm the syntax:

    ssh -i ~/.ssh/vultr_box root@155.138.231.13 "cat /etc/sudoers.d/deploy-restart"
    ssh -i ~/.ssh/vultr_box root@155.138.231.13 "visudo -c"

## 5. Read the backup script, then add the three lines

See `deploy/backup-additions.md`. Read the real script first, edit it second.

## 6. The ESV API key

Drew creates it at https://api.esv.org/account/create-application/ under his
own account, on the free non-commercial terms.

## 7. His login password

Run `npm run hash-password` on Drew's Mac to produce `APP_PASSWORD_HASH`. The
plaintext password never leaves his Mac and never gets committed anywhere.

## 8. Write the env file

    ssh -i ~/.ssh/vultr_box root@155.138.231.13
    mkdir -p /srv/deploy/arcing/{current,data}
    chown -R deploy:deploy /srv/deploy/arcing
    install -o root -g deploy -m 640 /dev/null /srv/deploy/arcing/.env

Its contents:

    APP_PASSWORD_HASH=<npm run hash-password, on Drew's Mac>
    SESSION_SECRET=<openssl rand -base64 32>
    ESV_API_KEY=<from step 6>
    DATA_DIR=/srv/deploy/arcing/data

`APP_E2E_AUTH` is never set here. It is dev-only and double gated on
`NODE_ENV`, which the standalone build pins to production.

## 9. The deploy key and the two GitHub secrets

    ssh-keygen -t ed25519 -f ~/.ssh/arcing_deploy -N "" -C "arcing deploy"
    ssh -i ~/.ssh/vultr_box root@155.138.231.13 \
      "cat >> /srv/deploy/.ssh/authorized_keys" < ~/.ssh/arcing_deploy.pub
    gh secret set BOX_SSH_KEY --repo dhendy11/arcing < ~/.ssh/arcing_deploy
    ssh-keyscan -H 155.138.231.13 | gh secret set BOX_KNOWN_HOSTS --repo dhendy11/arcing

## 10. Install the unit and the vhost

Diff the unit against the one already running before installing it, so this
app matches the box rather than this checklist's memory of it:

    ssh -i ~/.ssh/vultr_box root@155.138.231.13 "cat /etc/systemd/system/madori.service"

Then:

    scp -i ~/.ssh/vultr_box deploy/arcing.service root@155.138.231.13:/etc/systemd/system/
    ssh -i ~/.ssh/vultr_box root@155.138.231.13 "systemctl daemon-reload && systemctl enable --now arcing && systemctl status arcing --no-pager"
    ssh -i ~/.ssh/vultr_box root@155.138.231.13 "cat >> /etc/caddy/Caddyfile" < deploy/Caddyfile.arcing
    ssh -i ~/.ssh/vultr_box root@155.138.231.13 "caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy"

## 11. Prove it

    curl -sS -o /dev/null -w '%{http_code}\n' https://arcing.bushidoacquisitions.com/login

Expected: 200. If the DNS record from step 2 has not propagated yet, use the
loopback command from step 2 instead. Then sign in with the real password,
create one arc from the Fetch tab (which proves the ESV key), and confirm a
JSON file appears:

    ssh -i ~/.ssh/vultr_box root@155.138.231.13 "ls -la /srv/deploy/arcing/data/arcs"

## What this app never does

It never writes to the EA repo. The Saturday EA session reads
`GET /api/arcs` and appends the date, passage and main point to
`logs/journal.md` itself.
