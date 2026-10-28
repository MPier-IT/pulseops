# PulseOps

PulseOps is a React dashboard and public read-only status page backed by a Cloudflare Worker and D1. **Live monitoring is disabled in all environments.** Existing real and simulated records are retained. This is a restricted demonstration configuration, not an active monitoring service.

## Features

- Public, read-only Demo Dashboard with five fictional services, simulated availability charts, response times and incident history.
- Administrator-only controls to simulate degradation, outages and recovery; demo records stay separate from historical real-monitoring data.
- Session authentication, an incident timeline, local D1 persistence and a separate historical Public Status view.
- Real endpoint checks are fail-closed and disabled pending independently verified egress controls.

## Technology stack

React and TypeScript power the Vite frontend. A Cloudflare Worker serves the application and API, with Cloudflare D1 (SQLite) for persistence and version-controlled migrations. Vitest covers application and security behavior; Wrangler runs the Worker locally and bundles it for deployment.

## Screenshots

The public Demo Dashboard is the recommended portfolio view. See [screenshot guidance](docs/screenshots/README.md) for suggested captures and a pre-publication privacy review. Screenshots have not yet been added.

## Why monitoring is disabled

A Worker can validate a URL and query DNS before `fetch`, but the subsequent request uses Cloudflare's resolver independently. There is no verified connection-level binding between the checked address and the address actually reached. A hostname can change between those operations. Redirect checks alone do not solve that race. Cloudflare's [Workers known issues](https://developers.cloudflare.com/workers/platform/known-issues/) document hostname resolution and the limitation on direct IP subrequests. A public IP or hostname allowlist implemented only in the Worker is therefore not sufficient protection against DNS rebinding. Dedicated egress IPs identify the source of outbound traffic; they are not, by themselves, a destination restriction.

The safest practical next step for arbitrary endpoint monitoring is an independently enforced egress proxy or service that resolves the hostname, validates **all** resolved addresses, pins the actual connection to an approved address, verifies TLS against the original hostname, revalidates every redirect, enforces timeout/body/concurrency limits, and has network-level blocks on private, loopback, link-local, metadata and other special-use networks. Its deployment and policy need independent testing, including rebinding and redirect attacks. Cloudflare [VPC Service bindings](https://developers.cloudflare.com/workers-vpc/configuration/vpc-services/) can scope a Worker to a configured private service, potentially a dedicated egress proxy; they do not themselves establish the proxy's destination policy. VPC Network bindings can reach broader private networks and are not a substitute for an egress firewall. Dynamic Workers' [egress control](https://developers.cloudflare.com/dynamic-workers/usage/egress-control/) can intercept outbound requests but a handler that simply calls hostname-based fetch would retain the same DNS race. These options have not been provisioned or verified for this project.

There is no production flag that re-enables direct fetching. The scheduled handler is a no-op, the cron trigger is absent, creation of real endpoints returns 503, and changing existing real URLs is blocked. Five fictional services and seven days of synthetic checks are installed by an additive migration for the public Demo Dashboard. Administrators can simulate outages, degraded performance and recovery on those services; public visitors can explore them read-only. An additional simulated service can be selected by an administrator from the fixed catalog (`example.com` and `example.org`); the application does **not** resolve or contact either endpoint. Only its simulated checks and incidents change. Existing real records remain visible as historical and can become stale; the public page displays a warning. Pausing, editing non-URL fields and soft deletion of existing real services remain available to administrators. The local demo seed is installed by migration `0004_demo_dashboard.sql`; existing records are retained.

## Local demonstration

Requires Node.js 22.12 or later and npm:

```sh
npm install
npm run db:migrate
```

Copy the example file to your local secret file:

```sh
cp .dev.vars.example .dev.vars
```

Open `.dev.vars` in a local text editor and replace the empty `ADMIN_PASSWORD` value with a unique, randomly chosen password of at least 16 characters, keeping the surrounding quotes. Do not share it, put it in the example file, or commit `.dev.vars`. The optional email variables are only needed for local Resend testing. `.dev.vars` is ignored by Git. Then run:

```sh
npm run dev
```

Open the Vite URL printed by `npm run dev` (normally http://127.0.0.1:5173). The Demo Dashboard is available without login and shows simulated services, availability, response times and incident history. Sign in under Settings to use the outage, degradation and recovery controls on the Demo Dashboard. Select Public Status for historical real-monitoring data. No check contacts the selected domain. Demo results are excluded from real analytics and the public status page. The public view is read-only; real status, uptime, and incident history represent previously stored data and may be stale. Local D1 persists under `.wrangler/state`; do not delete it if you need to retain data.

## Architecture and access

The Worker serves the Vite assets and `/api/*`. D1 retains services, sessions, checks, incidents, incident events, login attempts and notification statuses. Existing incident history and analytics remain accessible. The historical public response omits endpoint URLs, failure reasons, sessions, demo data and notification details. A separate public demo endpoint returns only synthetic showcase data. Service names and descriptions are public; do not include sensitive information in them. Uptime is the percentage of successful real checks in the last 30 days, not a time-weighted SLA. MTTR uses up to the 100 most recent visible incidents.

Set `ADMIN_PASSWORD` as a Worker secret. Login creates an eight-hour random session stored as a hash in D1, with HttpOnly and SameSite=Strict cookies and Secure on HTTPS. Logout revokes it. Mutations require a session and a same-origin custom header. Login is limited to five attempts per IP per 15 minutes; this is not a distributed attack defense. Use a strong password, protect the Cloudflare account, and consider Cloudflare Access and WAF. Email uses a Resend adapter with secret credentials, but live delivery is not configured or verified. Sending an alert is a fixed provider request, not an arbitrary monitor request. Status `sent` means the provider accepted a submission, not that a mailbox received it.

## Deployment recommendation

For a public interview showcase, deploy only this **simulation-only** configuration after reviewing the public names, historical data, access controls, provider integration, and Cloudflare account settings. For a real monitoring service, do not enable outbound checks until a separately enforced proxy and network policy have been implemented, audited and tested against DNS rebinding, redirects and internal destinations. A demonstration deployment does not prove the security of a future live-monitoring deployment.

No deployment has been performed. To prepare one after explicit approval, create a uniquely named D1 database with `npx wrangler d1 create <unique-database-name>`; update this project's `wrangler.toml` Worker name, database name and database ID, and update `db:migrate:remote` in `package.json` if the database name differs. Confirm the account and back up any existing database. The migrations are additive; do not reset existing data. Then:

```sh
npx wrangler secret put ADMIN_PASSWORD
# Optional: only if a Resend account and verified sender are configured
npx wrangler secret put EMAIL_API_KEY
npx wrangler secret put EMAIL_FROM
npx wrangler secret put EMAIL_TO
npm run db:migrate:remote
npm run deploy
```

`npm run build` is a dry-run bundle and does not deploy. The checked-in database ID is a placeholder, and the configuration has no cron trigger.

## API

`GET /api/public`, `GET /api/demo/public` and `GET /api/session` are public. The demo response exposes only the fixed synthetic showcase records. Public responses expose `liveMonitoringEnabled: false`; they never trigger checks. `POST /api/login` accepts `{password}`. Other endpoints require the administrator session; mutations additionally require matching `Origin` and `X-PulseOps-Request: 1`. `POST /api/logout` revokes the session. `GET /api/dashboard` returns admin history and the fixed demo catalog. `POST /api/services` returns 503; `PUT /api/services/:id` cannot change its URL, and `DELETE /api/services/:id` soft-deletes it. `POST /api/demo/create` accepts `{catalogId: "example"}` or `{catalogId: "example-org"}`; `POST /api/demo` accepts `{serviceId,status}` (`down`, `degraded` or `operational`); `POST /api/demo/reset` recovers simulated services while retaining history.

## Testing

```sh
npm test
npm run typecheck
npm run build
```

The unit tests check that monitoring makes no outbound requests even for private addresses, loopback, metadata, redirects, and simulated DNS rebinding; that the scheduled handler makes no database changes; and that unauthenticated mutations are rejected. They do **not** validate an egress proxy, since none exists. To run integration checks against the local Worker and D1, start the app with `.dev.vars`, then run:

```sh
PULSEOPS_TEST_PASSWORD='your-local-password' node scripts/integration.mjs
```

This adds a demo service and incident to the local database and tests public isolation, authentication, blocked real endpoint creation, CSRF, demo recovery and logout. Use a separate local database for disposable testing if needed; do not reset existing data.

## Three-minute interview demonstration

1. Open the Demo Dashboard and explain that every service and metric is simulated and no endpoints are contacted.
2. Sign in, simulate a degradation or outage on a demo service, inspect its incident, and recover it.
3. Show Public Status and Analytics, explaining that historical real records are separate and live monitoring is disabled. Discuss the DNS rebinding limitation, the fail-closed design, and the requirements for a verified egress service.

## Roadmap

Build and independently test the egress proxy and network policies; add durable scheduling, notification retries, delivery webhooks, identity provider/MFA, time-weighted SLA reporting, pagination and retention. Re-enable real monitoring only after those controls are verified.
