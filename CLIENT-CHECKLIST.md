# Decisions and launch checklist

Updated 30 September 2026. This replaces the unresolved assumptions in the initial review.

## Confirmed by Matthew

- Phone: 01270 758779. Monitored email: pharmacy.fma50@nhs.net.
- Address and accessibility statements are correct. Instagram does not exist and has been removed.
- Keep mostonpharmacy.co.uk; Matthew operates the site, pharmacy funds it.
- Prescriptions are supplied through PharmaDoctor; consultations and follow-ups are handled at Moston.
- Use September 1st prices where supplied. Retain other prices, news and service promises for now.
- Use applicable text from the pharmacist's RTF and price-list documents.
- Reproduce the old prescription-authorisation process and email the details for pharmacy processing.
- Named accounts for editing prices/news.
- Test email: matthew.years18@gmail.com, using fictional information only.

## Ask the pharmacy

- [ ] Confirm the September price schedule, supply quantity for each price, consultation costs and current product availability. The editor is ready to demonstrate corrections together.
- [ ] Confirm inclusion of Ozempic in the supplied weight-management price sheet; it appears in the DOCX but not the RTF product list. Do not assume its inclusion establishes a weight-management indication.
- [ ] Review the actual public wording and placement of medicine information/prices before launch. Source wording is preserved; it has not been independently clinically validated. Resolve the inconsistent monthly weight-loss figures, switching advice and outcome claims in the source if the pharmacist wants revisions. Public advertising restrictions remain separate from authorship.
- [ ] Confirm both retained 2025 announcements remain suitable, especially “Pharmacy First - Contraception” and “full anonymity”. They are retained at the owner's request, not independently verified claims.
- [ ] Confirm the scope of Pharmacy First, including whether childhood earache should be added; existing six-condition content is retained.
- [ ] Confirm pharmacy registration 9010798 and legal trading details from the old site before adding a regulator link/badge.
- [ ] Provide the current complaints procedure, contact person and escalation route. The old external-provider page's ICAS contacts have not been copied.
- [ ] Approve the full privacy notice, lawful basis/special-category handling, email processor and the retention policy for submissions, mailbox copies, logs and backups. Assess DPIA requirements for this workflow.
- [ ] Confirm which staff will monitor incoming registration requests and what patients should expect after submitting.
- [ ] Decide whether patients should receive a copy of registration details. The old form offered this; this version avoids duplicating sensitive information to another inbox by default. It sends to the pharmacy only.
- [ ] Confirm delivery coverage, any exclusions and bank-holiday arrangements if more specific public guidance is wanted.
- [ ] Supply each editor's name and email, an account owner and an offboarding contact.
- [ ] Ask the old provider to redirect old URLs/domain, preserve any records according to policy and agree termination. Matthew cannot make these changes without access. Prefer a transition period over immediately losing old links.

## What Matthew needs to arrange

- [ ] Identify current hosting, domain registrar/DNS access and hosting budget.
- [ ] Select persistent backend hosting and approve an email provider with the pharmacy.
- [ ] Own the hosting/email accounts in a way that permits pharmacy handover; enable MFA and document billing/recovery ownership.
- [ ] Configure a verified sender on mostonpharmacy.co.uk. Receiving at an NHS address does not authorise sending from nhs.net.
- [ ] Store API credentials and the data-encryption key in hosting secrets, never in public code or chat.
- [ ] Test fictional enquiries and prescription registrations to Matthew's Gmail inbox, including spam folder and replies.
- [ ] Arrange a pharmacy staff member to confirm a final fictional-data test to pharmacy.fma50@nhs.net; Gmail delivery does not prove NHS inbox delivery.

## Implementation before public launch

- [ ] Final approved clinical, price, privacy and complaints content.
- [ ] Private staging access, production MFA/account recovery approach, trusted-proxy/edge abuse limits and production security review.
- [ ] Configure delivery/bounce and queue failure monitoring, alerts, encrypted off-host backups and a successful restoration drill.
- [ ] Provision fresh production accounts/database/key; do not upload the local demo database or credentials.
- [ ] Confirm real provider receipt, retries and delivery records; current automated provider tests use a fake response and are not real email-delivery evidence.
- [ ] Verify domain routing, HTTPS, canonical redirects and existing link migration. The local redirects cannot control the old provider's domain.
- [ ] Test the final deployment on mobile, keyboard, zoom and browsers; test production-specific privacy/access controls.
- [ ] Agree who maintains runtime updates, account removals, backups, email failures and renewals. Pharmacy owns routine news/prices and inbox processing.

## Suggested pharmacy demonstration

Show the new home page, local consultation explanation and delivery registration. Open the staff area, correct one September price together, save and refresh the public page. Add a draft news item, then publish it. Use a clearly fictional registration to demonstrate receipt without sending live patient information. Finish by assigning the outstanding client decisions above.
