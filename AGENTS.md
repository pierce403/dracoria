# Legacy Dracoria migration

This is the old Express/Mongoose app, separate from dracoria-thirdweb, which
already serves dracoria.org. Preserve that existing custom host. Publish this app
through native Cloudflare Git builds to a separate Worker address.

Keep the original MongoDB identity and SESSION_SECRET. Production data stays in
its existing external MongoDB; private BSON recovery copies belong outside Git.
Staging must use separate disposable MongoDB fixtures, its own session secret and
a local OpenAI stub. Never use the recovery database as app staging data.

Keep production mutations and scheduled growth blocked until the source writer
is stopped and the final backup/hosting checks pass. WebSockets follow password
session authentication. A connected wallet address does not authenticate a user.
No financial transaction, paid AI request or message to an existing user is
needed for validation. Remove secret/message logging before supplying credentials.

Use focused commits, preserve the original Heroku source/slug and disable its
automatic Git deploys before publishing migration commits to main. Native
Cloudflare builds own production; pause and verify them before manual recovery.
