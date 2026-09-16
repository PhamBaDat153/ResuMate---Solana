# ResuMate Resume and Credential Smart Contract

## 1. Tong quan

ResuMate la Anchor program tren Solana de xay dung ho so nghe nghiep co the kiem chung. Program dung vi Solana lam danh tinh, luu hash cua resume, quan ly issuer va ghi nhan credential.

Program ID hien tai:

```text
8SVXDqsBg2qQGxddweHmkG8rehnAzRx6uesjrv8TcR63
```

Program khong luu noi dung CV truc tiep. File PDF/DOCX va noi dung credential nam o he thong off-chain; blockchain chi luu hash, URI, quan he so huu va trang thai.

## 2. Van de duoc giai quyet

### 2.1 Resume co the bi sua

File CV gui qua email hoac website co the bi sua ma ben kiem tra khong biet. ResuMate luu `content_hash` 32 byte cua tung phien ban. Ben xac minh tai file ve, tinh lai hash va so sanh voi hash on-chain.

### 2.2 Kho xac minh bang cap va kinh nghiem

Nguoi dung co the tu khai bang cap, chung chi hoac kinh nghiem. Program chi cho issuer da duoc registry phe duyet cap credential. Credential ghi ro issuer, subject, claims hash, thoi diem cap, thoi han va trang thai thu hoi.

### 2.3 Phu thuoc vao mot he thong tap trung

Account Solana tao ra mot lop bang chung doc lap voi backend ResuMate. Khi backend thay doi hoac ngung hoat dong, du lieu off-chain van co the duoc doi chieu voi hash on-chain neu URI va tai lieu con ton tai.

### 2.4 Quyen kiem soat cua nguoi dung

Chi vi owner co the tao resume, cong bo phien ban, thay doi visibility va revoke phien ban. Credential do issuer cap khong tu dong duoc nguoi dung chap nhan; subject phai dat `subject_accepted = true`.

## 3. Kien truc tong the

```text
Wallet user
  -> UserProfile PDA
       -> Resume PDA 0 -> ResumeVersion PDA 0, 1, 2...
       -> Resume PDA 1 -> ResumeVersion PDA 0, 1, 2...
       -> Credential PDA 0, 1, 2...

Registry authority
  -> IssuerRegistry PDA
       -> Issuer PDA A
       -> Issuer PDA B

Issuer wallet
  -> issue/revoke Credential PDA cua user
```

Moi doi tuong la mot PDA rieng. Vi vay resume va credential cua hai user khong cung ghi vao mot account chung, giam write-lock va cho phep xu ly song song.

## 4. Du lieu on-chain va off-chain

### On-chain

- Dia chi owner, subject va issuer.
- Resume ID va version number.
- SHA-256 hash cua tai lieu va metadata.
- URI toi noi luu tai lieu.
- Thoi diem tao, thoi diem het han.
- Trang thai public, accepted va revoked.
- Counter va PDA bump.

### Off-chain

- File PDF/DOCX.
- Ho ten, email, so dien thoai va dia chi.
- Noi dung hoc van, kinh nghiem, ky nang.
- Noi dung chi tiet cua credential.
- Khoa giai ma neu tai lieu duoc ma hoa.

Khong nen luu PII truc tiep tren Solana vi account data co tinh cong khai va ton tai lau dai.

## 5. Account va PDA

### 5.1 UserProfile

Struct `UserProfile` nam trong `state.rs`:

```rust
pub struct UserProfile {
    pub owner: Pubkey,
    pub resume_count: u64,
    pub credential_count: u64,
    pub bump: u8,
    pub _reserved: [u8; 32],
}
```

PDA:

```text
["profile", owner_pubkey]
```

Profile la account goc cua mot user. `resume_count` va `credential_count` la ID tiep theo duoc cap cho resume va credential.

### 5.2 Resume

```rust
pub struct Resume {
    pub owner: Pubkey,
    pub resume_id: u64,
    pub active_version: u64,
    pub version_count: u64,
    pub is_public: bool,
    pub bump: u8,
    pub _reserved: [u8; 32],
}
```

PDA:

```text
["resume", owner_pubkey, resume_id.to_le_bytes()]
```

Mot user co the co nhieu resume. Vi du: CV backend, CV frontend, CV hoc thuat.

### 5.3 ResumeVersion

```rust
pub struct ResumeVersion {
    pub owner: Pubkey,
    pub resume: Pubkey,
    pub version: u64,
    pub content_hash: [u8; 32],
    pub metadata_hash: [u8; 32],
    pub content_uri: String,
    pub created_at: i64,
    pub is_revoked: bool,
    pub bump: u8,
}
```

PDA:

```text
["resume-version", resume_pubkey, version.to_le_bytes()]
```

Moi lan publish tao mot account version moi. Version cu khong bi ghi de. Day la mo hinh append-only, phu hop voi viec kiem tra lich su.

`content_hash` nen la hash cua file canonical, vi du:

```text
SHA-256(encrypted_resume_bytes)
```

`metadata_hash` la hash cua metadata canonical, khong phai noi dung tuy y do client serialize.

### 5.4 IssuerRegistry

```rust
pub struct IssuerRegistry {
    pub authority: Pubkey,
    pub bump: u8,
    pub _reserved: [u8; 64],
}
```

PDA:

```text
["issuer-registry"]
```

Registry khong luu danh sach vector issuer. Moi issuer co account rieng de tranh account lon va write-lock chung.

### 5.5 Issuer

```rust
pub struct Issuer {
    pub registry: Pubkey,
    pub issuer: Pubkey,
    pub issuer_type: u8,
    pub is_active: bool,
    pub bump: u8,
    pub _reserved: [u8; 32],
}
```

PDA:

```text
["issuer", issuer_pubkey]
```

`issuer_type` hien la `u8`, vi du `1 = university`, `2 = employer`, `3 = certification authority`. Vi tri nay nen duoc dinh nghia chung trong frontend, backend va tai lieu API.

### 5.6 Credential

```rust
pub struct Credential {
    pub subject: Pubkey,
    pub issuer: Pubkey,
    pub credential_id: u64,
    pub credential_type_hash: [u8; 32],
    pub claims_hash: [u8; 32],
    pub credential_uri: String,
    pub issued_at: i64,
    pub expires_at: Option<i64>,
    pub status: CredentialStatus,
    pub subject_accepted: bool,
    pub bump: u8,
}
```

PDA:

```text
["credential", subject_pubkey, credential_id.to_le_bytes()]
```

Credential doc lap voi resume. Mot credential co the duoc dung cho nhieu resume cua cung subject.

Trang thai credential:

```rust
pub enum CredentialStatus {
    Active,
    Revoked,
}
```

## 6. Cac instruction

### 6.1 `create_profile`

Nguoi dung ky giao dich va tao `UserProfile` PDA.

Dieu kien:

- `owner` phai la signer.
- Profile phai dung seed cua owner.
- Account chua ton tai, tranh re-initialization.

Ket qua:

- `resume_count = 0`.
- `credential_count = 0`.

### 6.2 `create_resume(resume_id)`

Tao mot resume moi cho owner.

Dieu kien:

- Profile phai thuoc ve owner.
- `resume_id` phai bang `profile.resume_count` hien tai.
- Resume PDA dung seed cua owner va ID.

Sau khi thanh cong, `resume_count` tang mot. Resume moi bat dau voi `version_count = 0` va `is_public = false`.

### 6.3 `publish_resume_version(content_hash, metadata_hash, content_uri)`

Cong bo mot phien ban moi cua resume.

Dieu kien:

- Owner phai ky giao dich.
- Resume phai thuoc owner.
- `content_hash` khong duoc la mang 32 byte toan so 0.
- URI khong dai qua 200 byte.

Program lay `resume.version_count` lam version number, tao `ResumeVersion` PDA, sau do cap nhat:

```text
active_version = version_number
version_count = version_number + 1
```

Luu y: `active_version` la phien ban vua publish gan nhat. Neu phien ban do bi revoke, program khong tu dong chuyen `active_version` ve phien ban truoc.

### 6.4 `set_resume_visibility(is_public)`

Owner bat hoac tat co che cong khai cua resume.

`is_public` chi la metadata de frontend quyet dinh hien thi. No khong phai co che bao mat blockchain: account Solana van co the duoc doc boi nguoi dung RPC. Neu tai lieu can rieng tu, file phai duoc ma hoa va key khong duoc luu on-chain.

### 6.5 `revoke_resume_version`

Owner danh dau version la `is_revoked = true`.

Account version khong bi dong va khong bi xoa. Nguoi xac minh phai kiem tra ca hash va co `is_revoked == false` truoc khi su dung.

### 6.6 `initialize_issuer_registry`

Tao registry PDA mot lan.

Vi registry PDA co seed co dinh, lan goi dau tien se thanh cong, cac lan sau bi Anchor tu choi vi account da ton tai. Vi authority duoc ghi vao account, vi nay phai la vi quan tri tin cay, tot nhat la multisig.

### 6.7 `register_issuer(issuer_type)`

Registry authority dang ky mot wallet issuer.

Dieu kien:

- Authority phai ky giao dich.
- Registry phai co `authority` trung signer.
- Issuer PDA duoc derive tu public key issuer.

Issuer duoc tao voi `is_active = true`. Issuer authority khong can ky giao dich dang ky; registry authority la ben phe duyet.

### 6.8 `set_issuer_active(is_active)`

Registry authority khoa hoac mo lai issuer.

Issuer bi inactive khong the cap credential moi. Code hien tai khong chan issuer inactive revoke credential cu; day la hanh vi hop ly cho thu hoi trong truong hop khan cap.

### 6.9 `issue_credential(...)`

Issuer cap credential cho subject.

Tham so:

```text
credential_id
credential_type_hash
claims_hash
credential_uri
expires_at: Option<i64>
```

Dieu kien:

- Issuer PDA phai derive tu signer issuer.
- Issuer phai `is_active`.
- Subject phai co profile.
- `credential_id` phai bang `subject_profile.credential_count`.
- Type hash va claims hash khong duoc rong.
- URI toi da 200 byte.
- Neu co expiry, expiry phai lon hon thoi diem hien tai.

Credential duoc tao voi:

```text
status = Active
subject_accepted = false
```

Issuer thanh toan rent cho credential account. Dieu nay cho phep issuer cap credential cho user ngay ca khi user khong co SOL, nhung issuer phai chu dong tai tro chi phi.

### 6.10 `accept_credential(accepted)`

Subject ky giao dich de chap nhan hoac bo chap nhan credential.

Program chi cho subject cua credential goi instruction. `accepted` khong thay doi nguon goc credential, issuer, hash hay trang thai revoke; no chi the hien subject co muon hien credential trong ho so hay khong.

Credential da revoke khong the accept lai.

### 6.11 `revoke_credential`

Issuer da cap credential ky giao dich de chuyen:

```text
Active -> Revoked
```

Khong co duong dan `Revoked -> Active`. Muon cap lai, issuer phai tao credential moi voi ID tiep theo.

## 7. Luong nghiep vu mau

### 7.1 User tao va cong bo resume

```text
1. User connect wallet.
2. Goi create_profile.
3. Upload file resume len storage off-chain.
4. Ma hoa file neu can rieng tu.
5. Tinh content_hash va metadata_hash.
6. Goi create_resume(resume_id = 0).
7. Goi publish_resume_version(...).
8. Frontend hien thi URI va thong tin version.
```

### 7.2 User cap nhat resume

```text
1. User sua file.
2. Upload file moi.
3. Tinh hash moi.
4. Goi publish_resume_version lan nua.
5. Resume.version_count tang.
6. Ban cu van ton tai de audit.
```

### 7.3 Issuer xac thuc va cap credential

```text
1. Registry authority khoi tao issuer registry.
2. Registry authority register_issuer.
3. Issuer tao JSON claims canonical off-chain.
4. Issuer tinh claims_hash.
5. Issuer upload credential document.
6. Issuer goi issue_credential.
7. Subject doc credential va goi accept_credential(true).
```

### 7.4 Nha tuyen dung xac minh

```text
1. Doc UserProfile va Resume PDA.
2. Kiem tra resume.is_public neu ung dung yeu cau cong khai.
3. Lay active ResumeVersion.
4. Tai tai lieu tu content_uri.
5. Tinh lai SHA-256.
6. So sanh voi content_hash.
7. Kiem tra is_revoked == false.
8. Kiem tra credential issuer co account Issuer va is_active.
9. Kiem tra Credential.status == Active.
10. Kiem tra expiry neu co.
11. Kiem tra claims_hash voi claims tai URI.
12. Kiem tra subject_accepted neu chi hien credential da duoc user chap nhan.
```

## 8. Quyen va trust model

| Tac nhan | Quyen |
|---|---|
| User wallet | Tao profile, tao resume, publish version, doi visibility, revoke resume version, accept credential |
| Registry authority | Khoi tao registry, register issuer, activate/deactivate issuer |
| Issuer wallet | Issue credential cho subject co profile, revoke credential cua minh |
| Nguoi doc/RPC/indexer | Doc account va event; khong duoc sua state |
| Backend | Luu file/claims off-chain; khong co quyen tu dong sua on-chain |

Backend khong duoc xem la nguon tin cay duy nhat. Nguon tin cay cho quyen la signer va account constraints tren chain.

## 9. Bao mat va gioi han

### 9.1 Hash khong ma hoa du lieu

Hash chi giup phat hien thay doi. Neu URI cong khai va file khong ma hoa, bat ky ai cung co the doc file. Can dung storage private/encrypted va chia key qua kenh ngoai chain.

### 9.2 URI van cong khai

`content_uri` va `credential_uri` nam on-chain. Khong dua access token, secret, API key hoac thong tin ca nhan nhay cam vao URI.

### 9.3 Registry authority la diem tin cay

Authority co the them issuer gia mao neu private key bi lo. Nen dung multisig, quy trinh KYC issuer, audit log va co che thay authority trong ban production.

### 9.4 Thay doi issuer key

Issuer PDA gan voi public key issuer. Neu to chuc doi wallet, registry can register issuer PDA moi. Nen co instruction transfer/rotate issuer trong phien ban sau neu can duy tri danh tinh to chuc on-chain.

### 9.5 Khong co instruction dong account

Resume, version va credential khong co instruction close. Dieu nay giu lich su audit nhung lam ton tai rent vinh vien. Co the them close an toan sau khi thiet ke chinh sach xoa du lieu ro rang.

### 9.6 Counter la ID tuan tu

`resume_count` va `credential_count` chi cho phep ID tiep theo. Cach nay tranh trung PDA nhung co the gap khoang ID neu sau nay ho tro xoa account. Hien tai khong co xoa nen ID tuan tu phu hop.

### 9.7 Credential khong gan voi mot resume

Credential gan voi subject wallet, khong gan mot resume version. Day la chu y de credential tai su dung cho nhieu CV. Frontend phai tu quyet dinh credential nao hien tren tung resume.

## 10. Events

Program emit cac event de indexer theo doi:

- `ProfileCreated`
- `ResumeCreated`
- `ResumeVersionPublished`
- `ResumeVisibilityChanged`
- `ResumeVersionRevoked`
- `IssuerRegistryInitialized`
- `IssuerRegistered`
- `IssuerStatusChanged`
- `CredentialIssued`
- `CredentialAcceptanceChanged`
- `CredentialRevoked`

Indexer nen luu ca transaction signature, slot, block time va account address. Khong nen chi phu thuoc vao chuoi log de xac minh state; can doc lai account tu RPC va kiem tra owner/discriminator.

## 11. Loi co the gap

| Error | Y nghia |
|---|---|
| `Unauthorized` | Signer khong phai owner, authority hoac issuer dung |
| `UriTooLong` | URI dai hon 200 byte |
| `EmptyHash` | Hash bat buoc la mang khac toan so 0 |
| `InvalidId` | ID khong phai counter tiep theo |
| `InvalidVersion` | Error code da khai bao nhung chua duoc su dung trong flow hien tai |
| `IssuerInactive` | Issuer dang bi registry khoa |
| `CredentialRevoked` | Credential da revoke |
| `InvalidExpiry` | Expiry khong nam sau issued_at |
| `CounterOverflow` | Counter u64 bi tran |

## 12. Build va test

Tu thu muc program:

```powershell
cd D:\Projects\Github\ResuMate---Solana\Source\resume
cargo fmt --all
cargo check --workspace
cargo test
cargo clippy --workspace --all-targets -- -D warnings
```

Test hien tai tai:

```text
programs/resume/tests/state_layout.rs
```

Test kiem tra:

- Kich thuoc account co phu hop voi `InitSpace`.
- PDA seed khong vuot gioi han seed cua Solana.

Can bo sung integration test LiteSVM/Surfpool truoc khi deploy, bao gom happy path va cac truong hop reject.

## 13. Checklist integration test can co

- Tao profile thanh cong.
- Tao resume voi ID 0 thanh cong.
- Tu choi tao resume voi ID khong phai counter.
- Publish version 0 va version 1.
- Tu choi content hash rong.
- Tu choi URI qua dai.
- Owner bat/tat visibility.
- Owner revoke version.
- Non-owner khong the sua resume.
- Khoi tao registry.
- Registry authority register issuer.
- Non-authority khong the register issuer.
- Issuer active issue credential.
- Issuer inactive khong the issue credential.
- Issuer khong phai nguoi cap khong the revoke credential.
- Subject accept va reject credential.
- Credential revoked khong the accept lai.
- Expiry qua hien tai bi tu choi.
- Credential ID phai dung counter tiep theo.

## 14. Vi tri trong ung dung ResuMate

Frontend hien tai da co Wallet Standard voi `@solana/kit` va `@solana/react`. Phan tiep theo can tao client layer cho cac instruction va PDA:

```text
Source/FE/lib/resumeProgram.ts
Source/FE/lib/pda.ts
Source/FE/lib/hash.ts
Source/FE/lib/storage.ts
```

Backend Java hien tai nhan file CV de evaluate. Backend co the tiep tuc xu ly AI va storage, nhung khong nen tu y gan credential issuer identity. Cac thao tac issue/revoke phai do issuer wallet ky, hoac do service signer duoc registry phe duyet ky.

## 15. Trang thai san sang

Program da co khung chuc nang chinh:

- Profile PDA.
- Resume PDA.
- Resume version PDA.
- Issuer registry va issuer PDA.
- Credential PDA.
- Authorization bang signer, seed va account relation.
- Hash va URI validation.
- Expiry va revoke status.
- Event cho indexer.

Truoc production can hoan thien:

- Integration tests day du.
- Client SDK/IDL va PDA helper.
- Storage encryption va key management.
- Multisig cho registry authority.
- Quy trinh rotate issuer.
- Quyet dinh co cho phep close account hay khong.
- Audit bao mat doc lap.
