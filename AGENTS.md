## Project

This repository supports LRC Property LLC products.

Primary product priority:
1. Formed.
2. Between The Lines

## Business rules

- LRC Property LLC is the parent company.
- Formed. is the first flagship product.
- Between The Lines is a second specialist product.
- Do not present any product as a law firm, tax service, accounting service, financial advisor, or government filing service.
- Do not submit payments, filings, purchases, or DNS changes.
- Payments may only be linked through configured Stripe URLs or clearly marked test-mode flows.

## Formed. rules

Formed. helps users turn messy ideas, documents, and setup tasks into a clean, launch-ready business packet.

Allowed language:
- organization
- templates
- checklists
- launch preparation
- business packet
- next steps

Avoid:
- legal advice
- tax advice
- accounting advice
- guaranteed filing
- government filing claims
- “we form your LLC” unless a compliant filing workflow is later added

## Between The Lines rules

Between The Lines generates structured investigative reports.

Reports should be:
- neutral
- evidence-based
- human-readable
- not accusatory
- not robotic
- not padded with filler

Required sections:
- Cover + metadata
- Key findings
- Timeline highlights
- Pattern analysis
- Behavioral signals
- Detailed chronology
- Methodology
- Disclaimer

Do not include a “Sensitivity” section.

## Development rules

- Keep changes minimal.
- Preserve existing deployment behavior.
- Inspect package.json before changing scripts.
- Do not move server.js unless required by the current app structure.
- Do not touch Stripe logic unless directly requested or required to prevent startup failure.
- Use environment variables for external URLs and secrets.
- Never commit secrets.
- Return files changed and run/test instructions after every task.
