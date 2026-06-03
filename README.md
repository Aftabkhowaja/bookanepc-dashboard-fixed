# BookAnEPC Live Revenue Dashboard

This is the corrected dashboard for the EPC lead platform.

It reads the real automation tabs from the Google Sheet:

- `Email Log`
- `Daily Send Queue`
- `Website Leads`
- `Replies`
- `Dashboard Metrics`

The dashboard deliberately does not hardcode sent-email totals. Real client sends are counted only from `Email Log`, and owner/test sends are separated so they do not look like revenue outreach.

## Deploy To Vercel

1. Open Vercel.
2. Create or update the dashboard project.
3. Use this folder as the project root:
   `C:\Users\aftab\OneDrive\Documents\EPC Automation\epc-dashboard-fixed`
4. Framework preset: `Other`.
5. Build command: leave empty.
6. Output directory: leave empty.
7. Deploy.

After deployment, check that:

- `Verified real emails today` matches actual client sends.
- `Owner/test sends today` shows preview emails separately.
- `Queue ready` matches `Daily Send Queue`.
- `Website leads today` updates after a landing-page enquiry.
