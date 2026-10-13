# Legacy Dracoria on Cloudflare

This Express/Mongoose/Socket.IO application uses one Cloudflare Container and
its existing external MongoDB. It is separate from the Thirdweb application
already serving dracoria.org. Its address is dracoria-legacy.bcrt43.workers.dev.

Native Cloudflare builds from main run npm run build and npx wrangler deploy
--env "". Deployment credentials remain in Cloudflare. Preview builds are
disabled. Preserve the original Heroku slug, configuration and source commit.

Production requires DATABASE_URL, SESSION_SECRET and OPENAI_API_KEY in Cloudflare
Worker secrets. Keep the existing session issuer and database identity. Secret
values and recovery exports never belong in this repository or build arguments.
The Docker context explicitly excludes environment files and recovery artifacts.

READ_ONLY=true rejects mutations and logout and prevents session writes. The
original hourly garden job is replaced with a Worker cron, which also respects
this switch. The source web dyno must be stopped before final MongoDB backup and
enabling Cloudflare writes because Heroku maintenance does not stop its job.
The public Worker denies the private health/growth RPC prefix. One container
retains the original shared Socket.IO hub; active frames renew its idle lifetime.

Staging uses Dockerfile.staging, independent session credentials, synthetic
staging_alice/staging_bob accounts (password fixture-password-only), local MongoDB
and a local OpenAI stub. It has no production data, internet access or cron.
Cold starts reset these disposable fixtures. Run npm run test:container to build
and test a fresh local fixture. Tests cover sessions, expiry/tampering, read-only
database digests, user isolation, WebSockets and a synthetic chat response.

Existing defects remain follow-up work: registration requires a wallet field
that its form does not submit; dashboard/settings templates are missing;
conversation deletion is incomplete; wallet login stores only a display address
and does not authenticate an account. Password login is the account interface.
Validation does not call paid AI, send real-user messages or perform transactions.

Rollback must first stop Cloudflare writes and its cron, then restart the original
Heroku source against the same database. MongoDB remains external to both hosts.
Retain verified private backups before any database/schema change or retirement.
