# Use the uploaded icon as the CaseX logo

## Scope
- Store the uploaded icon as a reusable app asset and create a correctly sized browser favicon from it.
- Replace the calculator mark in the main navigation, public home page, and sign-in/account shell.
- Add the icon beside the CaseXellence wordmark on PDF covers and page headers.
- Keep existing product names, labels, layout, and business behavior unchanged.

## Technical details
- Add a small shared logo component for consistent sizing and accessible alternative text.
- Use the CDN-backed image for app and PDF rendering; keep the required real 64×64 favicon file in `public/`.
- Update the root page metadata to reference the PNG favicon and remove the old template icon.
- Add PDF image styles without changing document content or pagination structure.
- Run focused tests/typechecking and visually verify desktop and mobile rendering.
