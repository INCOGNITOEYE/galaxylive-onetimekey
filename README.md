# GALAXY Central Key System

Starter scaffold for the GALAXY license portal.

## Included
- Animated galaxy landing page at `/`
- Admin placeholder at `/admin`
- Backend health endpoint at `/api/health`
- Vercel configuration
- Supabase dependency and environment-variable example

## Local setup
1. Install Node.js LTS and Git.
2. Open this folder in VS Code.
3. Open Terminal in VS Code and run:

   ```bash
   npm install
   npx vercel dev
   ```

4. Open the local URL printed by Vercel.

## Current status
This is a UI and backend scaffold only. Key generation, admin authentication, device binding, expiry enforcement, and short-link verification are not enabled yet.

Do not add real secrets to GitHub. Configure secrets in Vercel Environment Variables.
