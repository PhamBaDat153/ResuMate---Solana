## Why

Published resume versions currently expose a verified public Cloudinary URI and metadata, but the web application does not offer a convenient way to inspect the document. Users must copy the URI manually, and the UI does not distinguish browser-previewable PDF files from DOCX files that require download.

## What Changes

- Add a verified resume-version preview surface to the existing profile publishing flow.
- Render PDF versions inline when the browser can display the public Cloudinary resource.
- Provide open-in-new-tab and download fallbacks when inline PDF rendering is unavailable.
- Treat DOCX versions as download-only in the MVP and show the verified file metadata alongside the download action.
- Show the preview only for a ResumeVersion whose on-chain owner, Resume relationship, version, URI, hash, and non-revoked status have already been verified.
- Preserve the public-document warning and clearly state that `is_public` is not file access control.
- Do not convert DOCX to PDF, change Cloudinary storage behavior, alter hashes or URIs, or modify on-chain account layouts.

## Capabilities

### New Capabilities

- `resume-preview`: Let users inspect verified public resume versions in the web application, with PDF inline preview and DOCX download-only behavior.

### Modified Capabilities

- None.

## Impact

- Frontend: extend the existing profile/resume version success surface with preview, open, download, fallback, and loading/error states.
- Client data: reuse verified `ResumeVersionAccount` data and its public `contentUri`; no new Solana instruction or account is required.
- Cloudinary: rely on the existing public URL; no new upload or transformation pipeline is introduced.
- Privacy: preview and download remain public-resource access paths and must retain an explicit public-document warning.
- Tests: add UI tests for PDF, DOCX, fallback, invalid/missing URI, revoked or unverified state, and preview error handling.
