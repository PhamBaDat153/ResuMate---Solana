# ResuMate Smart Contract: Features and Actors

## 1. Muc dich

Tai lieu nay liet ke cac tinh nang hien co cua ResuMate Resume and Credential Smart Contract va cac actor tham gia vao tung tinh nang.

Program ID:

```text
8SVXDqsBg2qQGxddweHmkG8rehnAzRx6uesjrv8TcR63
```

Smart contract luu cac thong tin can thiet de xac minh quyen so huu, tinh toan ven cua resume, danh tinh issuer va trang thai credential. Noi dung file CV va claims chi tiet cua credential nen duoc luu off-chain.

## 2. Actors

| Actor | Mo ta | Quyen chinh |
|---|---|---|
| Resume Owner | Nguoi so huu vi va cac resume cua minh | Tao profile, tao resume, publish version, doi visibility, revoke resume version |
| Subject | Nguoi nhan credential | Chap nhan hoac bo chap nhan credential cua minh |
| Registry Authority | Vi quan tri issuer registry | Khoi tao registry, dang ky issuer, bat/tat issuer |
| Issuer | To chuc hoac vi duoc registry phe duyet | Cap credential va revoke credential do minh cap |
| Recruiter / Verifier | Nha tuyen dung hoac ben kiem tra | Doc account, hash, URI, issuer va trang thai de xac minh |
| Frontend Client | Ung dung web ket noi vi | Tao giao dich, hien thi du lieu, huong dan actor ky giao dich |
| Backend / Storage | He thong luu file va xu ly AI | Luu tai lieu off-chain, tinh hash, cung cap URI; khong tu dong co quyen sua on-chain |
| Blockchain RPC / Indexer | He thong doc va index du lieu Solana | Cung cap account, transaction va event cho client |

### 2.1 Actor khong phai la smart contract

Frontend, backend, storage va indexer khong co quyen dac biet neu khong co signer hop le. Smart contract chi tin cay vao:

- Chu ky giao dich.
- PDA seeds.
- Quan he giua cac account.
- Cac constraint va validation trong program.

## 3. Ma tran tinh nang va actor

| # | Tinh nang | Instruction | Actor chinh | Actor phoi hop | Ket qua |
|---:|---|---|---|---|---|
| 1 | Tao profile | `create_profile` | Resume Owner | Frontend, System Program | Tao `UserProfile` PDA cho wallet |
| 2 | Tao resume [Hoan thanh] | `create_resume` | Resume Owner | Frontend, UserProfile | Tao `Resume` PDA moi |
| 3 | Cong bo phien ban resume | `publish_resume_version` | Resume Owner | Backend, Storage, Frontend | Tao `ResumeVersion` voi hash va URI |
| 4 | Bat/tat resume cong khai | `set_resume_visibility` | Resume Owner | Frontend, Recruiter | Cap nhat `is_public` |
| 5 | Thu hoi phien ban resume | `revoke_resume_version` | Resume Owner | Frontend, Indexer | Dat `is_revoked = true` |
| 6 | Khoi tao issuer registry | `initialize_issuer_registry` | Registry Authority | Frontend, System Program | Tao registry PDA va gan authority |
| 7 | Dang ky issuer | `register_issuer` | Registry Authority | Issuer, Frontend | Tao issuer PDA va dat active |
| 8 | Bat/tat issuer | `set_issuer_active` | Registry Authority | Issuer, Frontend | Cap nhat `is_active` |
| 9 | Cap credential | `issue_credential` | Issuer | Subject, Storage, Frontend | Tao credential active cho subject |
| 10 | Chap nhan credential | `accept_credential` | Subject | Frontend, Issuer | Cap nhat `subject_accepted` |
| 11 | Bo chap nhan credential | `accept_credential(false)` | Subject | Frontend | Credential khong duoc subject chap nhan de hien thi |
| 12 | Thu hoi credential | `revoke_credential` | Issuer | Subject, Frontend | Chuyen credential tu `Active` sang `Revoked` |
| 13 | Xac minh resume | Doc account va tinh hash | Recruiter / Verifier | RPC, Storage, Indexer | Kiem tra file trung voi hash on-chain |
| 14 | Xac minh credential | Doc account va kiem tra status | Recruiter / Verifier | RPC, Storage, Indexer | Kiem tra issuer, claims hash, expiry va revoke status |

## 4. Chi tiet tinh nang theo actor

## 4.1 Resume Owner

### Tao profile

**Instruction:** `create_profile`

Resume Owner ky giao dich de tao mot `UserProfile` PDA voi seed:

```text
["profile", owner_pubkey]
```

Profile theo doi:

- Dia chi owner.
- So luong resume da tao.
- So luong credential cua subject.

Profile la dieu kien dau vao cho viec tao resume va nhan credential.

### Tao resume

**Trang thai:** Da hoan thanh.

**Instruction:** `create_resume(resume_id)`

Resume Owner tao mot resume moi voi seed:

```text
["resume", owner_pubkey, resume_id.to_le_bytes()]
```

Resume moi co:

- `active_version = 0`.
- `version_count = 0`.
- `is_public = false`.

`resume_id` phai bang `profile.resume_count` hien tai. Cach nay dam bao ID duoc cap tuan tu va tranh trung PDA.

### Cong bo version resume

**Instruction:** `publish_resume_version`

Resume Owner upload file off-chain, tinh hash, sau do ky giao dich publish version.

Du lieu luu on-chain:

- `content_hash`.
- `metadata_hash`.
- `content_uri`.
- Thoi diem tao.
- Resume owner.
- Resume PDA.
- Version number.

Version PDA:

```text
["resume-version", resume_pubkey, version.to_le_bytes()]
```

Version cu khong bi ghi de. Moi lan publish tao mot account version moi, giup giu lich su resume.

### Quan ly visibility

**Instruction:** `set_resume_visibility(is_public)`

Owner co the bat hoac tat `is_public`.

Luu y: `is_public` la metadata cho frontend, khong phai co che bao mat tuyet doi. Du lieu tren Solana van co the duoc doc qua RPC. Tai lieu nhay cam can duoc ma hoa off-chain.

### Thu hoi version

**Instruction:** `revoke_resume_version`

Owner co the danh dau mot version la revoked. Account van ton tai de giu lich su audit, nhung verifier phai tu choi version co `is_revoked = true`.

## 4.2 Registry Authority

### Khoi tao registry

**Instruction:** `initialize_issuer_registry`

Registry Authority tao mot registry duy nhat voi seed:

```text
["issuer-registry"]
```

Registry luu dia chi authority. Vi nay la goc tin cay cua he thong issuer.

### Dang ky issuer

**Instruction:** `register_issuer(issuer_type)`

Registry Authority phe duyet mot wallet issuer va tao issuer PDA:

```text
["issuer", issuer_pubkey]
```

Issuer duoc tao voi:

- Dia chi issuer.
- Loai issuer.
- Registry lien ket.
- `is_active = true`.

Issuer wallet khong can tu ky giao dich dang ky. Authority la actor co quyen phe duyet.

### Bat/tat issuer

**Instruction:** `set_issuer_active(is_active)`

Registry Authority co the tam dung issuer khi:

- Issuer khong con duoc tin cay.
- Phat hien private key issuer bi lo.
- Can dieu tra to chuc.
- Can ngan cap credential moi.

Issuer bi inactive khong the issue credential moi. Code hien tai van cho phep issuer dung de revoke credential cua minh.

## 4.3 Issuer

### Cap credential

**Instruction:** `issue_credential`

Issuer phai la wallet da duoc registry dang ky va dang active.

Issuer cap credential cho mot subject da co `UserProfile`.

Credential PDA:

```text
["credential", subject_pubkey, credential_id.to_le_bytes()]
```

Credential luu:

- Subject wallet.
- Issuer wallet.
- Credential ID.
- Hash loai credential.
- Hash claims.
- URI toi tai lieu credential.
- Thoi diem cap.
- Thoi diem het han neu co.
- Status `Active`.
- Trang thai subject da chap nhan hay chua.

Issuer phai thanh toan rent cho credential account.

### Thu hoi credential

**Instruction:** `revoke_credential`

Chi issuer da cap credential moi duoc revoke credential do.

State transition:

```text
Active -> Revoked
```

Khong co transition nguoc lai. Neu can cap lai credential, issuer tao credential moi.

## 4.4 Subject

Subject la user nhan credential. Subject khong cap credential cho chinh minh va khong sua issuer, hash hay status.

### Chap nhan credential

**Instruction:** `accept_credential(true)`

Subject ky giao dich de xac nhan credential co the duoc hien thi trong ho so.

### Bo chap nhan credential

**Instruction:** `accept_credential(false)`

Subject co the bo chap nhan credential. Credential van ton tai va van do issuer cap, nhung frontend co the an credential nay khoi resume public.

Credential da revoked khong the duoc accept lai.

## 4.5 Recruiter / Verifier

Recruiter khong can signer de doc va xac minh state. Recruiter can:

1. Doc resume PDA va version PDA.
2. Kiem tra owner va PDA seeds.
3. Kiem tra `is_revoked == false`.
4. Tai file tu `content_uri`.
5. Tinh lai SHA-256.
6. So sanh voi `content_hash`.
7. Doc issuer PDA.
8. Kiem tra issuer co ton tai va `is_active` neu chinh sach yeu cau.
9. Doc credential status.
10. Tu choi credential neu `status == Revoked`.
11. Kiem tra `expires_at` neu credential co han.
12. So sanh claims off-chain voi `claims_hash`.
13. Kiem tra `subject_accepted` neu chi chap nhan credential duoc subject cong nhan.

## 4.6 Frontend Client

Frontend khong phai la authority. Frontend co nhiem vu:

- Ket noi Wallet Standard.
- Derive PDA dung seed.
- Tao instruction voi tham so dung.
- Hien thi transaction preview.
- Yeu cau actor dung ky giao dich.
- Theo doi confirmation.
- Doc account va event sau khi giao dich thanh cong.
- Hien thi loi authorization, hash, expiry va status.

Frontend khong nen tu luu private key, seed phrase hoac credential signing key.

## 4.7 Backend va Storage

Backend/Storage xu ly:

- Upload file resume.
- Ma hoa file neu can.
- Tinh `content_hash`.
- Tinh `metadata_hash`.
- Luu file va tra ve URI.
- Luu credential claims off-chain.
- Tinh `claims_hash`.
- Xu ly AI evaluation va job matching.

Backend khong duoc tu dong xem minh la issuer. Lenh `issue_credential` phai duoc issuer wallet ky, tru khi backend chinh la service cua mot issuer da duoc registry phe duyet.

## 5. Bang quyen truy cap

| Du lieu / thao tac | Resume Owner | Subject | Registry Authority | Issuer | Recruiter |
|---|---:|---:|---:|---:|---:|
| Tao profile cua minh | Co | Co | Co | Co | Tuy chinh |
| Tao resume | Co | Co neu la owner | Khong | Khong | Khong |
| Publish resume version | Co | Co neu la owner | Khong | Khong | Khong |
| Doi visibility resume | Co | Co neu la owner | Khong | Khong | Khong |
| Revoke resume version | Co | Co neu la owner | Khong | Khong | Khong |
| Khoi tao registry | Khong mac dinh | Khong mac dinh | Co | Khong | Khong |
| Register issuer | Khong | Khong | Co | Khong | Khong |
| Deactivate issuer | Khong | Khong | Co | Khong | Khong |
| Issue credential | Khong | Khong | Khong | Co neu active | Khong |
| Accept credential | Khong | Co neu la subject | Khong | Khong | Khong |
| Revoke credential | Khong | Khong | Khong | Co, neu la issuer goc | Khong |
| Doc account | Co | Co | Co | Co | Co |
| Xac minh hash | Co | Co | Co | Co | Co |

## 6. Event theo actor

| Event | Actor kich hoat | Muc dich |
|---|---|---|
| `ProfileCreated` | Resume Owner | Bao profile moi duoc tao |
| `ResumeCreated` | Resume Owner | Bao resume moi duoc tao |
| `ResumeVersionPublished` | Resume Owner | Bao version moi va content hash |
| `ResumeVisibilityChanged` | Resume Owner | Bao thay doi visibility |
| `ResumeVersionRevoked` | Resume Owner | Bao version bi revoke |
| `IssuerRegistryInitialized` | Registry Authority | Bao registry da duoc khoi tao |
| `IssuerRegistered` | Registry Authority | Bao issuer moi duoc phe duyet |
| `IssuerStatusChanged` | Registry Authority | Bao issuer active/inactive |
| `CredentialIssued` | Issuer | Bao credential moi duoc cap |
| `CredentialAcceptanceChanged` | Subject | Bao subject chap nhan/bo chap nhan |
| `CredentialRevoked` | Issuer | Bao credential bi revoke |

## 7. Luong actor tong quat

```text
Registry Authority
  -> initialize_issuer_registry
  -> register_issuer
  -> set_issuer_active

Resume Owner
  -> create_profile
  -> create_resume
  -> publish_resume_version
  -> set_resume_visibility
  -> revoke_resume_version

Issuer
  -> issue_credential
  -> revoke_credential

Subject
  -> accept_credential(true/false)

Recruiter / Verifier
  -> read accounts
  -> recompute hashes
  -> verify issuer, status and expiry
```

## 8. Gioi han can luu y

- Du lieu on-chain la public; `is_public` khong phai encryption.
- URI da luu on-chain khong nen chua secret.
- Hash chi chung minh tinh toan ven, khong chung minh claims la su that neu issuer khong dang tin.
- Registry Authority la root of trust cua danh sach issuer.
- Credential khong gan voi mot resume cu the; credential thuoc ve subject wallet.
- Version bi revoke khong bi xoa khoi blockchain.
- Issuer key rotation chua co instruction rieng.
- Integration test day du va client SDK van can duoc bo sung truoc production.
