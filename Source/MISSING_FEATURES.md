# ResuMate - Missing Features

Danh sách này ghi lại các chức năng còn thiếu hoặc mới hoàn thành một phần trong encrypted credential workflow.

Trạng thái sử dụng:

- `Missing`: chưa có implementation thực tế.
- `Partial`: đã có một phần UI hoặc helper nhưng chưa hoạt động end-to-end.
- `Implemented`: đã có implementation cơ bản nhưng vẫn có thể cần hardening hoặc integration test.

## P0 - Credential Flow End-to-End

Các chức năng này là blocker chính. Nếu chưa hoàn thành, issuer có thể tạo credential nhưng subject/verifier chưa thể giải mã và xác minh tự động.

| Status | Feature | Current gap | Related code |
|---|---|---|---|
| Partial | Wrapped document key cho issuer | Có `wrapAesKey`, nhưng `/issuer` chưa wrap AES document key và chưa lưu wrapped key cho issuer. | `FE/lib/credentialCrypto.ts`, `FE/app/issuer/page.tsx` |
| Missing | Wrapped document key cho subject | Issuer chưa lấy encryption public key của subject và chưa tạo wrapped key cho subject. | `FE/app/issuer/page.tsx`, `FE/lib/verifierIdentity.ts` |
| Missing | Wrapped document key cho verifier | Subject/issuer chưa wrap AES key cho wallet verifier hoặc link verifier một cách tự động. | `FE/app/subject-grants/page.tsx`, `FE/lib/grantProgram.ts` |
| Partial | Claims trong encrypted package | Claims hash được tính nhưng claims JSON chưa được lưu đầy đủ trong package; verifier có thể thất bại ở bước claims verification. | `FE/app/issuer/page.tsx`, `BE/.../CredentialPackageStorageService.java` |
| Partial | Credential package metadata | Package có ciphertext, IV và hashes nhưng chưa có đầy đủ key metadata, package version và recipient metadata. | `FE/lib/credentialPackageApi.ts`, `BE/.../CredentialPackageStorageService.java` |
| Missing | Tự động cấp wrapped key sau khi issue | Sau khi `issue_credential`, hệ thống chưa tạo các grant cần thiết cho issuer/subject. | `FE/app/issuer/page.tsx`, `FE/lib/grantProgram.ts` |

## P0 - Verifier And Access Grants

| Status | Feature | Current gap | Related code |
|---|---|---|---|
| Missing | Decode `AccessGrant` account | Có PDA derivation và instruction serialization nhưng chưa có decoder/fetch account. | `FE/lib/grantProgram.ts` |
| Missing | Decode `LinkGrant` account | Chưa đọc status, expiry, use count hoặc wrapped key từ chain. | `FE/lib/grantProgram.ts` |
| Missing | Fetch grants by credential | Verifier/subject chưa thể tải danh sách grant của một credential. | `FE/lib/grantProgram.ts` |
| Partial | Wallet verifier flow | Có public-key helper và `/verify`, nhưng verifier vẫn phải nhập wrapped key thủ công. | `FE/app/verify/page.tsx`, `FE/lib/verifierIdentity.ts` |
| Missing | Tự động lấy wallet access grant | `/verify` chưa derive hoặc fetch `AccessGrant` PDA theo credential và verifier wallet. | `FE/app/verify/page.tsx` |
| Missing | Link verification route | Chưa có route dạng `/verify/link/[grantId]` để xử lý access link không cần wallet. | `FE/app/verify/page.tsx` |
| Partial | Link sharing UI | Có tạo secret và `alert`, nhưng chưa tạo URL share hoàn chỉnh, copy button hoặc link route. | `FE/app/subject-grants/page.tsx` |
| Missing | Link grant consume | Chưa có flow kiểm tra secret hash, expiry, status và tăng `use_count`. | `resume/programs/resume/src/instructions/grant.rs` |
| Missing | Enforce `max_uses` | `max_uses` được lưu nhưng chưa được enforce khi link được sử dụng. | `resume/programs/resume/src/instructions/grant.rs` |
| Partial | Grant expiry validation | Creation có kiểm tra expiry, nhưng frontend verifier chưa đọc và kiểm tra expiry của grant PDA. | `FE/lib/grantProgram.ts`, `FE/lib/credentialVerification.ts` |

## P1 - Encryption Identity And Key Management

| Status | Feature | Current gap | Related code |
|---|---|---|---|
| Partial | Public key persistence | Backend public-key endpoint chỉ validate rồi trả lại dữ liệu; chưa lưu persistence thật. | `BE/.../CredentialAccessController.java` |
| Partial | Subject public-key registration | Subject tạo key local nhưng chưa đăng ký public key ổn định với backend hoặc metadata service. | `FE/app/encryption-setup/page.tsx` |
| Partial | Verifier public-key registration | Có helper đăng ký nhưng chưa có UI setup riêng và backend storage thật. | `FE/lib/verifierIdentity.ts` |
| Partial | Key rotation | Có key version trong type, nhưng chưa có rotation flow, grant migration hoặc version lookup hoàn chỉnh. | `FE/lib/encryptionIdentity.ts`, `FE/lib/verifierIdentity.ts` |
| Partial | Backup/recovery | Private key được mã hóa bằng passphrase trong localStorage, nhưng chưa có export/import backup hoàn chỉnh. | `FE/lib/encryptionIdentity.ts`, `FE/app/encryption-setup/page.tsx` |
| Implemented | Tách signing key và encryption key | Encryption identity riêng với Solana wallet signing key đã được tạo. | `FE/lib/credentialCrypto.ts`, `FE/lib/encryptionIdentity.ts` |
| Missing | Secure platform key storage | Chưa có WebAuthn/IndexedDB/OS keystore hoặc cơ chế bảo vệ key ngoài localStorage. | `FE/lib/encryptionIdentity.ts` |

## P1 - Verification Security

| Status | Feature | Current gap | Related code |
|---|---|---|---|
| Partial | On-chain status verification | Đã kiểm tra `Active`, `Revoked` và expiry của credential. | `FE/lib/credentialVerification.ts` |
| Missing | Issuer PDA policy verification | Chưa fetch issuer account để kiểm tra issuer tồn tại, `is_active` hoặc policy verifier. | `FE/lib/credentialVerification.ts` |
| Implemented | Subject acceptance policy | `/verify` có tùy chọn yêu cầu subject acceptance. | `FE/app/verify/page.tsx` |
| Partial | Document hash verification | Có recompute SHA-256 sau decrypt, nhưng chỉ hoạt động khi access key và package hợp lệ. | `FE/lib/credentialVerification.ts` |
| Partial | Claims hash verification | Logic có sẵn nhưng package hiện chưa luôn chứa claims envelope đầy đủ. | `FE/lib/credentialVerification.ts` |
| Implemented | Download disclosure | UI cảnh báo rằng plaintext đã tải xuống không thể revoke từ xa. | `FE/app/verify/page.tsx` |
| Partial | Key-loss recovery | Có cảnh báo passphrase nhưng chưa có backup import/recovery workflow. | `FE/app/encryption-setup/page.tsx` |

## P1 - Backend And Storage

| Status | Feature | Current gap | Related code |
|---|---|---|---|
| Partial | Encrypted package upload | Có upload encrypted package qua Cloudinary, nhưng metadata validation và package schema còn đơn giản. | `BE/.../CredentialPackageStorageService.java` |
| Missing | Package metadata persistence | Chưa có database/repository hoặc metadata index cho credential package. | `BE/src` |
| Missing | Access grant persistence service | Thiết kế hiện tại chuyển grant chính lên Solana, nhưng backend chưa có metadata/audit support tương ứng. | `BE/src` |
| Missing | Public-key registry persistence | Public keys không được lưu bền vững. | `BE/.../CredentialAccessController.java` |
| Missing | Audit events | Chưa lưu identity changes, package creation, grant changes, link use hoặc verification outcomes. | `BE/src` |
| Partial | Request validation | Có kiểm tra ciphertext, IV, PDF và URI, nhưng chưa validate đầy đủ Base64, hash format, algorithm, claims schema và package size. | `BE/.../CredentialPackageStorageService.java` |
| Missing | Encrypted package size limit | Chưa có giới hạn rõ ràng cho ciphertext, Base64 body và JSON envelope. | `BE/.../CredentialPackageController.java` |
| Partial | PDF-only credential storage | Frontend và backend đã giới hạn PDF, nhưng cần bổ sung test contract cho MIME spoofing và file signature. | `FE/app/issuer/page.tsx`, `BE/.../CredentialPackageStorageService.java` |

## P1 - Solana Program And Client Tests

| Status | Feature | Current gap | Related code |
|---|---|---|---|
| Partial | Grant authorization tests | Program đã cho issuer/subject tạo grant, nhưng chưa có đầy đủ integration tests cho các nhánh authorization. | `resume/programs/resume/tests` |
| Missing | Access grant integration tests | Chưa test create/revoke, unauthorized grantor, revoked credential và immutable credential fields. | `resume/programs/resume/tests` |
| Missing | Link grant integration tests | Chưa test secret, expiry, `max_uses`, consume và revoke. | `resume/programs/resume/tests` |
| Partial | Frontend grant serialization tests | Có test PDA và instruction bytes cơ bản, nhưng chưa cover account layout decode/fetch. | `FE/lib/grantProgram.test.ts` |
| Partial | Concurrent issuance tests | Có error handling stale ID nhưng chưa có full integration test cho race giữa issuer transactions. | `resume/programs/resume/tests`, `FE/lib/credentialProgram.ts` |

## P2 - User Experience

| Status | Feature | Current gap | Related code |
|---|---|---|---|
| Partial | Subject grant UX | Có `/subject-grants`, nhưng vẫn yêu cầu nhập wrapped key thủ công. | `FE/app/subject-grants/page.tsx` |
| Partial | Verifier setup UX | Có `/encryption-setup`, nhưng chưa có flow riêng cho verifier registration, key rotation và lookup. | `FE/app/encryption-setup/page.tsx` |
| Partial | Link sharing UX | Hiện dùng `alert` thay vì shareable URL, clipboard action và link list. | `FE/app/subject-grants/page.tsx` |
| Missing | Grant history | Subject/issuer chưa xem được các access grant đang active/revoked. | `FE/app/subject-grants/page.tsx`, `FE/app/issuer/page.tsx` |
| Partial | Error states | Các trang chính có loading/error states, nhưng grant/verification errors chưa đồng nhất và chưa có transaction details. | `FE/app/subject-grants/page.tsx`, `FE/app/verify/page.tsx` |
| Implemented | PDF credential selection | `/issuer` chỉ nhận PDF và tự tạo encrypted package URI. | `FE/app/issuer/page.tsx` |

## P2 - Deployment And Rollout

| Status | Feature | Current gap | Related code |
|---|---|---|---|
| Missing | Feature flags | Chưa có cơ chế bật/tắt issuer, subject access hoặc verifier flows theo môi trường. | Project-wide |
| Missing | Deployment configuration | Chưa có CI/CD hoặc deployment manifest cho frontend/backend/program. | Project-wide |
| Missing | Environment validation | Chưa có startup validation đầy đủ cho RPC, backend URL, Cloudinary và program network. | `FE/components/solana-provider.tsx`, `BE/src/main/resources` |
| Missing | Staging rollout | Chưa có staging environment hoặc smoke test flow. | Project-wide |
| Missing | Production rollout | Chưa triển khai production và chưa có rollback procedure. | Project-wide |
| Missing | Monitoring and alerting | Chưa có monitoring cho failed uploads, grant transactions, verification failures hoặc key loss. | Project-wide |

## Recommended Order

1. Hoàn thiện claims envelope và wrapped AES key cho issuer/subject.
2. Lưu public encryption keys thật và tạo grant PDA sau khi issue.
3. Thêm decoder/fetch cho `AccessGrant` và `LinkGrant`.
4. Cho `/verify` tự lấy grant thay vì nhập wrapped key thủ công.
5. Hoàn thiện link verification, expiry và `max_uses`.
6. Thêm issuer PDA policy verification.
7. Viết Anchor integration tests cho grants và links.
8. Thêm key backup/rotation và audit events.
9. Thiết lập feature flags, staging và production rollout.

## Current Assessment

Các route UI chính đã tồn tại:

- `/issuer`
- `/subject-grants`
- `/encryption-setup`
- `/verify`

Tuy nhiên encrypted credential workflow chưa hoàn chỉnh end-to-end. Blocker lớn nhất hiện tại là wrapped document key chưa được tạo, lưu và phân phối tự động; claims envelope cũng chưa được lưu đầy đủ để verifier có thể kiểm tra claims hash.
