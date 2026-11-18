# Running LearningLinks day to day

For the owner and any helper. Server setup is in `docs/DEPLOY.md`. Commands assume you are in the `learninglinks` folder on the server and have run `export COMPOSE_FILE=deploy/docker-compose.yml`.

## Every working day (about 10 minutes at the start)

Open `/admin` (English). It has three queues.

1. **Waiting for payment.** Check the bank account. For each transfer that arrived, find the order by the **reference code** in the transfer note (the "Find an order by reference" box accepts any capitalisation), check the amount equals the order total, then press **Confirm payment** with the amount and the date on the bank statement. The membership starts at that moment and the buyer is emailed.
   - **Invoices.** The site records the buyer's invoice details (company name, 統一編號, email) but does not issue invoices. Issue the uniform invoice (統一發票) or receipt yourself, or through your accountant, when you confirm a payment. Ask your lawyer or accountant which entity must issue it.
   - Amount does not match (short or too much): do **not** confirm. Contact the buyer, then cancel the order or ask them to pay the difference.
   - Nothing arrived after a few days: leave it. The buyer can cancel it themselves.
2. **School claims to review.** Each claim names a school, a contact and a phone number. We do not verify licences or identity. Check that the school exists (its website or a phone call) and that the claimant is plausible, then **Approve** or **Reject**. Approving one claim automatically rejects other claims on the same campus.
3. **Reports to review.** Read the reason and details, look at what was reported, then:
   - **Hide the profile / Suspend the school / Remove the job post** when it breaks the rules. The affected person is emailed and told how to appeal. Every open report about the same target is closed together.
   - **Dismiss** when there is nothing wrong.
   Aim to answer reports within two working days. The reporter is never revealed to the person reported.

**Suspended right now** lists everything hidden by moderation, with a **Reinstate** button. A reinstated educator profile comes back *hidden*: the educator publishes it again when they choose.

**Appeals** arrive at your `SUPPORT_EMAIL`. Look at the report in `/admin` history (reports keep their reason, details and who resolved them), decide, and reinstate if needed.

## Things that happen by themselves

- **Renewal reminders** go out 60, 30, 7 and 0 days before a membership ends. Nothing renews automatically and no card is charged.
- **Nightly backups** go into `backups/` (database dump and profile photos). Check now and then: `ls -lh backups | tail`.

## Looking after the server

```bash
docker compose ps                 # everything should say "running" or "healthy"
docker compose logs --tail 100 app
docker compose restart app
```

If `/api/health` shows `{"status":"unavailable"}`, the app cannot reach the database: run `docker compose ps` and look at `db`.

## Restore a backup

Practise this once on a spare database so you know it works. A restore **replaces everything** in the database it runs against.

```bash
ls backups/db-*.sql.gz                       # pick the dump you want
docker compose stop app                      # nothing may write during the restore
docker compose cp deploy/restore.sh db:/tmp/restore.sh
docker compose cp backups/db-YYYYMMDDTHHMMSSZ.sql.gz db:/tmp/restore.sql.gz
docker compose exec -e PGUSER=learninglinks -e PGDATABASE=learninglinks db bash /tmp/restore.sh /tmp/restore.sql.gz
docker compose up -d app
```

Profile photos: unpack `backups/uploads-….tar.gz` into the `uploads` volume (`docker compose cp` the file in, then `tar -xzf` inside the `app` container's `/data/uploads`).

## Privacy requests

People can hide, withdraw consent for, and delete their own profile and account in their educator settings. If someone writes to you instead, ask them to do it themselves from settings. If that is not possible, an administrator can delete the account on the server (this removes the account, profile, contacts and reports they made, and cannot be undone):

```bash
docker compose exec db psql -U learninglinks -d learninglinks \
  -c "delete from \"user\" where email = 'person@example.com';"
```

Then delete that person's photo file: it is in the `uploads` volume under `photos/`, named by the `photo_key` of their profile (look it up **before** deleting the account). The consent history is kept without personal content, by design.

## Known limits

- **Suspension is per profile or school.** An educator who deletes a suspended profile and signs up again starts clean. If you see this pattern in the reports, add an account-level ban (a small change) before it becomes a problem.
- **Email delivery** depends on Resend. If people say they never get verification emails, check its dashboard first.
- **Single server.** See the note in `docs/DEPLOY.md`.
