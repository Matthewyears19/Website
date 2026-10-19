# Moston Pharmacy

A working local demonstration of the refined website, named staff sign-in, price/news editor and custom form backend. Not deployed. No external email service has been configured or tested yet.

## Open the demonstration

Use Node.js 24.13 or later in the 24.x line. From this folder:

```powershell
node --env-file-if-exists=.env app/server.js
```

Open http://127.0.0.1:4173. The staff editor is at http://127.0.0.1:4173/admin. Your generated local-only login is saved in `data/demo-access.txt`. It is deliberately excluded from Git and never served by the website. Do not deploy this database or these credentials.

If the preview is already running, simply open its address. To stop a foreground server use Ctrl+C. Restart after changing server/template code; CSS and browser JavaScript changes need a browser refresh.

## Demo walkthrough

1. Show Home → Weight management → Treatment prices.
2. Sign in to the staff area. Change a price and save. Refresh the public price page to see the update; restore the original afterwards.
3. Add a news article. Leave Published unchecked to keep it private, then publish it when ready. Dates label articles; they do not schedule publication.
4. Submit an enquiry or prescription registration using fictional details. The confirmation explicitly says no email has been sent in demonstration mode.
5. The staff editor shows queue status and who last changed website content. It does not expose patient information.

## What changed

- A shared layout, consistent green/cream design, responsive navigation and accessible labelled forms.
- Completed prescription registration, contact, directions, weight management and existing Pharmacy First information.
- Confirmed contact/address/accessibility information; removed Instagram and Formspree.
- Local Moston consultations/follow-up with prescriptions supplied through PharmaDoctor.
- September prices where available, with other supplied prices retained. Both original news announcements retained with spelling corrections.
- Pharmacist-provided paragraphs and FAQs retained verbatim where used. The obsolete paragraph promising pre-September prices is omitted because the owner selected September prices. The embedded Bing redirect and “see attached document” editing instruction are omitted. See the launch checklist for clinical/publication review.
- Shared data, SQL persistence, named accounts, change history and protection against overwriting another editor’s changes.
- Routes for previous HTML paths redirect to the new pages. The unfinished team page redirects to Contact. The old-provider domain still requires action by that provider.
- Google Maps now opens through a directions link rather than an embedded third-party map. No analytics or advertising cookies are added.

The original website is preserved in `../archive/original-website`. The two source documents are unchanged. The original review is historical; use CLIENT-CHECKLIST.md for current decisions.

## Code map

| Location | Purpose |
|---|---|
| `app/config.js` | One place for business details and initial price/news data |
| `app/pages.js` | Shared page layout and page content |
| `app/server.js` | HTTP routes, sessions, security headers, enquiry queue and email delivery |
| `app/store.js` | SQL tables, password hashing, encryption and content transactions |
| `app/validation.js` | Server-side form and content validation |
| `app/accounts.js` | Provision, reset and disable named staff accounts |
| `app/backup.js` | Consistent SQL snapshot |
| `content/` | Extracted pharmacist source and retained Pharmacy First content |
| `public/` | Browser CSS, JavaScript and optimised images |
| `tests/` | Backend regression checks with fictional data |
| `data/` | Private runtime database, local encryption key and demo login; never public |

No package install is needed. This keeps the local demonstration small. The bundled Node SQLite API is version-sensitive; review its support/stability when finalising production hosting. This is a single-server implementation, not a multi-instance or serverless deployment.

## Verify

```powershell
node --test tests/*.test.js
```

Read BACKEND.md for the operational design and CLIENT-CHECKLIST.md for the remaining launch inputs. Do not upload this project as a static GitHub Pages site: it now needs a running backend and persistent storage.
