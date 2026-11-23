# Putting LearningLinks on a real address

This guide takes the site from this repository to a live address on one Linux server. It assumes no server experience; each step says what to type and what you should see. Anyone who runs servers can do it in an afternoon, so you can also hand this page to a helper.

Everything below is for **Phase 1 (Taiwan)**. Online payment uses ECPay (see `docs/PAYMENTS.md`); other countries come later.

## What you need

| Need | Notes |
|---|---|
| A server | Ubuntu 24.04, 2 CPUs, 4 GB memory, 40 GB disk is enough to start. Choose a region close to Taiwan (Taipei if offered, otherwise Tokyo or Singapore). **Where the server is matters for the privacy policy**, so tell your lawyer. |
| A domain name | For example `learninglinks.tw`. You must be able to edit its DNS records. |
| An email service | The site uses [Resend](https://resend.com). Free tier is fine at first. Production refuses to run sign-up without it. |
| An ECPay merchant account | For online payment (card, ATM, convenience store). See `docs/PAYMENTS.md`. |
| Your bank details | Optional once ECPay is on. Account name, number, bank and branch, for the order page. |
| About 3 hours | Most of it is waiting for DNS. |

## 1. Point the domain at the server

At your domain registrar, add an **A record**: name `@` (or the host you chose), value = the server's IP address. Wait until `ping your-domain` shows that address.

## 2. Prepare the server

Log in over SSH, then:

```bash
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
sudo apt-get update && sudo apt-get install -y git unattended-upgrades
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"   # log out and back in afterwards
```

The firewall opens only SSH, HTTP and HTTPS. The database is never reachable from the internet.

## 3. Get the code and write the settings

```bash
git clone https://github.com/grantturner7-prog/learninglinks.git
cd learninglinks
cp deploy/env.production.example .env
nano .env
```

Fill in every line of `.env`. Generate the three secrets on the server:

```bash
openssl rand -base64 32     # BETTER_AUTH_SECRET
openssl rand -base64 24     # POSTGRES_PASSWORD
openssl rand -base64 32     # CRON_SECRET
```

`ADMIN_EMAILS` is the address you will sign up with to use `/admin`. `SUPPORT_EMAIL` is the public contact address shown on the legal pages. Keep `LEGAL_REVIEWED=false` until your lawyer has approved the legal text (see step 8). Put your ECPay production keys in `ECPAY_MERCHANT_ID`, `ECPAY_HASH_KEY`, `ECPAY_HASH_IV` and set `ECPAY_MODE=production`; leave them empty to keep online payment off.

## 4. Set up email

1. In Resend, **add your domain** and copy the DNS records it shows (SPF and DKIM) into your domain's DNS.
2. Wait for Resend to show the domain as verified, then create an **API key** and put it in `.env` as `RESEND_API_KEY`.
3. Set `EMAIL_FROM` to an address on that domain, for example `LearningLinks <no-reply@learninglinks.tw>`.

## 5. Check the settings, then start

```bash
docker compose -f deploy/docker-compose.yml --env-file .env build
docker compose -f deploy/docker-compose.yml --env-file .env run --rm migrate npm run preflight
```

`preflight` prints one line per setting. **FAIL** lines must be fixed before you open the site. **WARN** lines are worth reading but do not block (for example the draft legal banner). Then:

```bash
docker compose -f deploy/docker-compose.yml --env-file .env up -d
```

This starts the database, applies the database migrations, starts the app, the HTTPS proxy (it gets a free certificate for your domain by itself), the daily reminder job and the nightly backup. To avoid typing the long command, add `export COMPOSE_FILE=deploy/docker-compose.yml` to your shell.

## 6. Check it works

- `https://your-domain/api/health` shows `{"status":"ok"}`.
- Open the home page in English and Chinese.
- **Create your admin account:** sign up with the address in `ADMIN_EMAILS`, click the link in the verification email, then open `/admin`. You should see the Admin desk.
- **Try a whole payment with test accounts:** sign up a test family, place an order on the join page, then pay it (online: a real payment of NT$2,000 by your own card, refunded afterwards in ECPay's back office; bank transfer: confirm it in `/admin` with the amount), and check the family can now see educators. Delete the test accounts afterwards (they can delete their own account in settings, or see the runbook).
- Send yourself a password-reset email to prove email works.

## 7. Backups

The `backup` service writes a compressed database dump and a copy of the profile photos into the `backups/` folder every night and keeps 14 days (`BACKUP_KEEP_DAYS`). That protects you from mistakes, **not from losing the server**. Copy the folder somewhere else as well, for example nightly to cloud storage with `rclone`, or to another machine with `rsync`. Test a restore once before you need one: see `docs/RUNBOOK.md`.

## 8. Before you tell anyone the site is open

1. `preflight` shows no FAIL lines.
2. Your lawyer has approved the Terms, Privacy Policy and Educator Waiver. Then set `LEGAL_REVIEWED=true` in `.env` and run `docker compose up -d` again to remove the draft banner.
3. The open questions in `docs/MASTER_PLAN.md` that need counsel are answered, in particular job advertising and the licence for the school-location data.
4. Remove demo data if you loaded any: `npm run db:seed-demo -- --remove`.
   Load the school data (see `docs/LAUNCH_DATA.md`): `npm run db:import-schools`, then `npm run db:import-moe -- --prune` (government and private schools, universities, international schools), then `npm run db:import-cram -- --national` (cram schools; run it from Taiwan), then `npm run db:import-school-photos` (the reviewed school pictures; it needs to reach upload.wikimedia.org and is slow by design, about one picture every few seconds). Run each of these in the tools container so files land where the site reads them, for example `docker compose -f deploy/docker-compose.yml --env-file .env run --rm migrate npm run db:import-school-photos -- --dry-run`.
5. Set an uptime monitor (for example UptimeRobot) on `https://your-domain/api/health`, with an email alert to you.

## Updating the site later

```bash
cd learninglinks
git pull
docker compose -f deploy/docker-compose.yml --env-file .env up -d --build
```

The migration step runs automatically before the new app starts. If an update goes wrong, check out the previous version (`git checkout <earlier commit>`), run the same command, and restore the last backup if the database was changed.

## Good to know

- **One server.** The abuse limits (sign-in tries, report and reveal bursts) are kept in the app's memory, which is correct for one server. If you ever run several copies of the app, move those limits into the database first.
- **Logs.** `docker compose logs -f app` shows what the site is doing. Emails are sent through Resend; its dashboard shows delivery problems.
- **Secrets.** `.env` holds every secret. Keep it out of git and out of chat. To rotate a secret, change it in `.env` and run `up -d` again (changing `BETTER_AUTH_SECRET` signs everyone out).
- **Dependency warnings.** `npm audit` reports advisories in build and test tools (vitest, drizzle-kit, esbuild). None of them is part of the production image, which holds only what the running site needs. Re-check with `npm audit --omit=dev` before launch and after each big update.
- **Social sign-in must stay off.** It would let people create accounts without the compliance acknowledgement. `preflight` fails if it is configured.
