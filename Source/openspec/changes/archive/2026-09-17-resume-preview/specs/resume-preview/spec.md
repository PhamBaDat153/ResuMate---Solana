## Purpose

Let users inspect a verified public resume version from the web without changing the original document, its Cloudinary URI, or its on-chain cryptographic commitments.

## ADDED Requirements

### Requirement: Preview only verified resume versions
The system SHALL offer preview or download actions only for a ResumeVersion that has already been verified against its Resume, owner, version number, URI, hashes, and non-revoked status.

#### Scenario: Verified active version is available
- **WHEN** a ResumeVersion has passed on-chain verification and contains a valid public HTTPS content URI
- **THEN** the system displays the file metadata and makes the appropriate preview or download action available

#### Scenario: Version is missing, revoked, or unverified
- **WHEN** the ResumeVersion cannot be verified, is missing, or has `is_revoked = true`
- **THEN** the system does not present the document as a verified preview and does not expose a new document action from that state

### Requirement: Preview PDF documents inline
The system SHALL attempt to display verified PDF resume versions inline using their existing public content URI without modifying the downloaded bytes or on-chain content hash.

#### Scenario: Browser renders the PDF inline
- **WHEN** the verified version metadata identifies `application/pdf` and the browser can render the public resource
- **THEN** the system displays an inline PDF preview and provides an open-in-new-tab or download alternative

#### Scenario: Inline PDF rendering is unavailable
- **WHEN** the browser, Cloudinary response headers, network, or embedding policy prevents inline PDF rendering
- **THEN** the system displays an actionable fallback to open the verified URI in a new tab or download the original file, without reporting a preview failure as a chain verification failure

### Requirement: Handle DOCX documents as download-only
The system SHALL identify verified DOCX resume versions and SHALL provide a download or open-original action without attempting to render the DOCX as an inline browser document in the MVP.

#### Scenario: Verified DOCX version is available
- **WHEN** the verified version metadata identifies the DOCX media type
- **THEN** the system displays the file name, media type, size, and a download/open-original action

#### Scenario: DOCX preview is requested
- **WHEN** a user selects the DOCX preview area
- **THEN** the system explains that browser preview is unavailable for this MVP and provides the original public file action

### Requirement: Preserve public access and integrity warnings
The system SHALL communicate that the preview and download use a public Cloudinary URI and SHALL not imply that Resume visibility protects the file from anyone who knows the URI.

#### Scenario: User views preview controls
- **WHEN** preview or download controls are displayed
- **THEN** the system shows a public-document warning and does not expose credentials or invent a private access boundary

#### Scenario: Preview uses a public URI
- **WHEN** the user opens, previews, or downloads the document
- **THEN** the system uses the verified `contentUri` unchanged and does not replace it with a transformed or unrelated asset

### Requirement: Handle preview and URI failures safely
The system SHALL distinguish a document-rendering or network failure from an on-chain verification failure and SHALL provide safe fallback actions for a valid verified version.

#### Scenario: URI is malformed or not HTTPS
- **WHEN** a version passes account decoding but its content URI fails client URL validation
- **THEN** the system hides direct preview/download actions and displays an invalid-resource error without changing on-chain state

#### Scenario: Public resource cannot be loaded
- **WHEN** the verified URI cannot be fetched or embedded
- **THEN** the system keeps the verified metadata visible, reports that the public document is unavailable, and offers retry/open-in-new-tab where applicable
