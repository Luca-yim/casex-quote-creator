# Speridian Quote Builder

I want to build the CaseX Pricing Calculator — an internal sales tool for

Speridian Technologies. Sales representatives use it to generate defensible

quotes for CaseXellence, a case management platform sold to government agencies.

Focus for this build: the Ballpark tier (~16 questions, ~5 minute completion).

Tech stack requirements:

- React 18 + TypeScript (strict mode)

- Vite

- Tailwind CSS with a custom brand token system (I'll provide colors below)

- shadcn/ui component library

- Zustand for client state

- TanStack Query for server state

- Supabase for backend (auth, database, realtime)

- react-hook-form + Zod for form validation

- Vitest for unit tests

- Playwright for E2E tests

Design principles:

- Enterprise-modern aesthetic (inspired by Linear, Stripe Dashboard, Attio)

- Card-based questionnaire with live pricing sidebar

- Progressive disclosure — advanced options only when relevant

- Rep stays in control — auto-derived values are always overridable

- Real-time recalculation as inputs change

Brand tokens:

- Primary blue: #003BD4

- Secondary teal: #0075D4

- Accent navy: #001A5C

- Font families: Inter (body), Poppins (brand), JetBrains Mono (prices)

Core UI layout:

- Sticky top header with Speridian logo (I'll add later) and action buttons

- Two-column layout: questionnaire on left (60%), pricing sidebar on right (40%)

- The sidebar is sticky and shows: baseline TCV, margin slider, line items,

  assumptions log, risk snapshot, tier chip

- Cards for each question section, with emoji icons

For this initial scaffold, please:

1. Set up the project with all the dependencies above

2. Configure Supabase connection (I'll provide credentials)

3. Create the two-column layout with header, questionnaire container, and sidebar

4. Build the first three question sections as placeholders:

   - Customer Info (name, customer type, contract term)

   - Vertical & Solution (two-level dropdown)

   - Module Tier (radio: Standard $735K or Enterprise $975K)

5. Include a live-updating pricing sidebar (even if calculations are simple for now)

6. Set up Vitest and write one placeholder test to prove the test infra works

Do NOT build all sections yet. I'll add them incrementally. Prioritize a

clean architecture over feature completeness.

Also, use this branding prompt

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d6dbd3b7-d55b-47b9-b60c-594d301d8d0f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
