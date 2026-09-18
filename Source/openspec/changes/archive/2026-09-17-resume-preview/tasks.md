## 1. Verified Preview Boundary

- [x] 1.1 Define a preview input model that accepts only an already verified ResumeVersion and exposes owner, version, media type, file name, size, URI, hash, and revoke state; verify the component cannot be rendered from an arbitrary unverified URI.
- [x] 1.2 Add HTTPS URI validation with host validation and no URI rewriting; verify malformed, non-HTTPS, missing, and transformed-looking inputs are handled without changing on-chain data.
- [x] 1.3 Add PDF/DOCX media-type classification using validated metadata; verify `application/pdf` selects preview mode, DOCX selects download-only mode, and unknown types use a safe fallback.

## 2. PDF Preview and Fallbacks

- [x] 2.1 Add an inline PDF preview using the verified public URI; verify the frame/object has an accessible title and does not replace the original URI or hash.
- [x] 2.2 Add explicit `Mở trong tab mới` and `Tải xuống` actions for PDF; verify both actions use the unchanged verified URI and open safely without exposing application secrets.
- [x] 2.3 Add a non-blocking PDF load/error state; verify an iframe or object failure preserves verified metadata and keeps open/download fallbacks available.
- [x] 2.4 Add responsive preview sizing and mobile-safe fallback behavior; verify the preview card remains usable on narrow viewports when inline rendering is unavailable.

## 3. DOCX and Public Warning UX

- [x] 3.1 Add DOCX download/open-original presentation with file name, media type, size, version, and verified URI context; verify the UI does not claim DOCX inline rendering.
- [x] 3.2 Add a visible warning that Cloudinary files and on-chain URIs are public and `is_public` is not access control; verify the warning appears for both PDF and DOCX actions.
- [x] 3.3 Add loading, unavailable-resource, malformed-URI, revoked/unverified, and retry states; verify rendering/network errors are distinct from on-chain verification errors.

## 4. Integration and Verification

- [x] 4.1 Integrate the preview card into the existing published ResumeVersion success surface without changing publish, hash, URI, or account-verification behavior; verify published metadata remains visible alongside preview controls.
- [x] 4.2 Add frontend tests for verified PDF, verified DOCX, invalid URI, missing URI, revoked version suppression, unverified suppression, fallback actions, and rendering failure; verify tests do not require real Cloudinary access.
- [x] 4.3 Run frontend lint, unit/component tests, TypeScript checks, and production build; verify the preview route/surface compiles with the existing Next.js and Solana provider setup.
- [x] 4.4 Verify no backend endpoint, Cloudinary upload option, Solana instruction, account layout, hash, or on-chain URI changes as part of preview; confirm the public warning and original URI behavior in tests.
