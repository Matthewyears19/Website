# Verification — 30 September 2026

## Passed locally

- Automated tests cover validation, page responses, private-file access denial, unauthorised editing, password sign-in, origin/CSRF protection, concurrent editing conflicts, HTML escaping, price publication, duplicate submissions, encrypted payloads, prescription authorisation, retention and logout.
- Email adapter tests use fictional data and a fake provider response to verify test-recipient routing, failure/retry, provider-accepted status, payload removal and expiry of automatic retries. No real email was sent.
- A SQLite backup snapshot was reopened successfully; its integrity check passed and edited content was present.
- Browser sign-in to the named demo account succeeded. A £199 price was changed to £200 and saved, then restored to £199. The public page displayed the original September prices after restoration.
- The browser contact form accepted fictional details and displayed “Demonstration saved locally. No email has been sent.”
- Home, weight management, prescription registration, contact, directions, Pharmacy First and staff pages were checked at 320px width with no document-level horizontal overflow.
- Desktop homepage visually inspected at 1280px width; logo loaded correctly. Mobile menu expanded successfully.
- Application and browser JavaScript, CSS and tests were formatted consistently. Tests passed after formatting.

## Not yet verified

Real email delivery (Gmail or NHS), DNS, production hosting, MFA, provider bounce alerts, edge/proxy limits, encrypted off-host backup scheduling, full accessibility audit, external penetration test and clinical/legal publication approval. See CLIENT-CHECKLIST.md.

Screenshots are local preview evidence, not a deployed website. The review images and demonstration account are for this project only.
