# Security policy

## Reporting a vulnerability

Please report security issues to **security@pasmello.com**. Include:

- A clear description of the issue and its impact
- Steps to reproduce (or a proof-of-concept)
- Your name / handle for credit, if you'd like it

We aim to acknowledge reports within 72 hours and to ship a fix within
30 days for high-severity issues. Please give us that window before
public disclosure.

## Scope

In scope:

- Registry API (registry.pasmello.com) and web UI (market.pasmello.com)
- CLI (`mello`) distributed via get.pasmello.com and GitHub Releases
- Package envelope schema and publish-pipeline validation logic

Out of scope:

- Individual published packages — report those to the package's author
- Cloudflare / Fly.io / Neon infrastructure issues — report to the vendor
- Clickjacking on pages without sensitive actions
- Denial-of-service that requires more traffic than our rate limits allow

## Safe harbor

We won't take legal action against good-faith researchers who:

- Don't access or modify data belonging to others
- Don't degrade service (no load tests without coordination)
- Don't publicly disclose before we've had a chance to fix
