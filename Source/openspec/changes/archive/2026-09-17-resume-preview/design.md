## Context

The existing profile page already displays a verified `ResumeVersionAccount` after publication. The account includes the public `contentUri`, original metadata hash, content hash, version, timestamp, owner, Resume relationship, and revoke state. Cloudinary currently receives PDF and DOCX files as public raw assets, so its dashboard may show `Format: N/A` and no preview even though the original bytes remain available at the URI.

There is no preview component or preview route today. The browser can commonly render PDF resources inline, while DOCX rendering is not dependable without a conversion or external viewer service. The change therefore focuses on a client-side presentation layer and preserves the existing storage and blockchain commitments.

## Goals / Non-Goals

**Goals:**

- Give users a clear preview/download experience for already verified published versions.
- Support inline PDF preview with robust fallback controls.
- Make DOCX behavior explicit and download-only for the MVP.
- Preserve public-resource warnings and exact verified URI usage.
- Keep rendering failures separate from chain verification failures.

**Non-Goals:**

- Changing Cloudinary `resource_type`, upload filenames, delivery headers, or public IDs.
- Converting DOCX to PDF or generating preview derivatives.
- Adding private/authenticated delivery, access control, encryption, or signed URLs.
- Changing ResumeVersion PDA/account layout, hashes, URI, visibility, revoke behavior, or verifier semantics.
- Adding server-side proxying or downloading the document into application storage.

## Decisions

### Render from the verified content URI

The preview receives a `ResumeVersionAccount` only after the existing verification path succeeds. It uses the exact `contentUri` committed on-chain. This avoids showing a preview for an unverified asset and ensures the displayed document corresponds to the hash/URI commitments.

An application proxy was considered, but it would add bandwidth, caching, content-type, and privacy behavior while providing no access control for already-public assets. Direct public delivery is the smallest consistent approach for this MVP.

### Use media type to choose preview mode

Use verified metadata rather than filename extension:

```text
application/pdf                                  --> inline PDF attempt
application/vnd.openxmlformats-officedocument... --> download/open original
other or missing                                 --> generic safe fallback
```

The UI may display the original filename for context, but extension alone must not override the validated media type.

### Keep fallback actions independent of iframe success

An iframe/object cannot reliably report all browser, CSP, cross-origin, or Cloudinary header failures. Always render explicit `Mở trong tab mới` and `Tải xuống` actions alongside the PDF preview attempt. If the embedded frame reports an error, show a non-blocking message and keep those actions available.

```text
[Verified version]
       |
       v
  [PDF?] --yes--> [Inline preview]
       |                  |
       |                  +--> [Open tab] [Download]
       |
       +--no--> [DOCX metadata] --> [Download] [Open original]
```

### Validate URL before exposing actions

Require an HTTPS URL with a valid host. Do not rewrite query parameters, add Cloudinary transformations, or construct an alternate URL. A malformed URI is a presentation error, not a reason to alter the version account or mark the version invalid on-chain.

### Preserve the public warning

The preview card explicitly states that Cloudinary delivery is public and `is_public` does not protect the document. This warning remains visible for both PDF preview and DOCX download because both actions access the same public URI.

### Test in the existing profile publishing surface

Add focused component tests for verified PDF, verified DOCX, invalid URI, revoked/unverified suppression, fallback action presence, and iframe/load error handling. Mock the browser rendering boundary and do not fetch real Cloudinary documents in unit tests. No backend or Solana program changes are needed.

## Risks / Trade-offs

- [Cloudinary raw response does not render inline] -> Always provide open-tab and download fallbacks; do not treat it as a chain failure.
- [DOCX cannot render in browsers] -> Make download-only behavior explicit rather than introducing an unplanned conversion service.
- [Public URL exposes the CV] -> Keep the warning visible and do not imply Resume visibility is access control.
- [External resource changes or disappears] -> Keep verified on-chain metadata visible and report document availability separately.
- [Iframe embedding restrictions vary by browser] -> Test fallback controls and avoid relying on iframe load events for correctness.
- [A UI bug displays an unverified resource] -> Make the preview component accept only the verified version result, not arbitrary URI input.

## Migration Plan

No migration or deployment change is required. The feature can be released against existing published ResumeVersion accounts and Cloudinary URLs. Rollback consists of removing or hiding the preview controls; document storage, hashes, and on-chain state remain unchanged.
