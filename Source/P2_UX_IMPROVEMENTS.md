# P2 - User Experience Improvements

Tài liệu này tổng hợp các trải nghiệm người dùng cần cải thiện trong nhóm `P2 - User Experience` của ResuMate.

Phạm vi chỉ tập trung vào UX của các flow hiện có:

- Subject quản lý quyền truy cập.
- Verifier thiết lập encryption identity.
- Chia sẻ credential bằng link.
- Xem lịch sử grant.
- Hiển thị lỗi và thông tin giao dịch.

Không bao gồm các vấn đề deployment, rollout, monitoring, feature flags hoặc backend audit/indexer.

## 1. Subject Grant UX

### Hiện trạng

Route `/subject-grants` hiện cho phép subject:

- Chọn credential.
- Nhập verifier wallet address.
- Nhập grant ID.
- Nhập wrapped document key bằng hex.
- Tạo hoặc thu hồi `AccessGrant`.
- Tạo hoặc thu hồi `LinkGrant`.

### Vấn đề

- Subject phải nhập wrapped document key thủ công, dễ sai và khó hiểu với người dùng phổ thông.
- Subject phải tự biết verifier wallet address và grant ID.
- Không có danh sách các grant hiện có cho credential đang chọn.
- Sau khi tạo hoặc thu hồi grant, giao diện chưa refresh danh sách trạng thái một cách rõ ràng.
- Thông báo lỗi chưa phân biệt rõ lỗi wallet, lỗi authorization, lỗi credential và lỗi input.

### UX cần cải thiện

- Hiển thị form theo từng bước: chọn credential, chọn recipient, xác nhận quyền, hoàn tất.
- Validate wallet address và grant ID trước khi gửi transaction.
- Hiển thị trạng thái transaction: đang chuẩn bị, chờ ký, đang xác nhận, thành công hoặc thất bại.
- Sau khi mutation thành công, tự động refresh grant list.
- Hiển thị empty state khi credential chưa có grant.
- Hiển thị grant hiện có với recipient, grantor, key version, expiry và status.
- Cho phép revoke trực tiếp từ từng grant trong danh sách.
- Không yêu cầu người dùng thao tác với raw wrapped key nếu hệ thống đã có đủ encryption identity và public-key metadata.

## 2. Verifier Encryption Setup UX

### Hiện trạng

Route `/encryption-setup` hiện cho phép:

- Tạo encryption identity local bằng passphrase.
- Hiển thị public key.
- Xóa identity local.
- Load lại public key từ browser storage.

Các helper đăng ký và lookup verifier identity đã tồn tại trong `FE/lib/verifierIdentity.ts`, nhưng page chưa cung cấp flow hoàn chỉnh.

### Vấn đề

- Chưa có bước kết nối wallet trong setup verifier.
- Chưa có trạng thái public key đã được đăng ký với wallet hiện tại hay chưa.
- Chưa có nút register/re-register public key lên backend.
- Chưa hiển thị key version và thời điểm đăng ký.
- Chưa có flow rõ ràng cho key rotation.
- Chưa có UX backup/recovery trực tiếp trên page.
- Người dùng khó biết local identity và Solana signing wallet là hai loại khóa khác nhau.

### UX cần cải thiện

- Hiển thị rõ hai trạng thái:
  - Local encryption identity.
  - Wallet public-key registration.
- Yêu cầu connected wallet trước khi register identity.
- Hiển thị registration status: chưa đăng ký, đã đăng ký, cần đồng bộ hoặc đăng ký thất bại.
- Hiển thị key version hiện tại và version trên backend/on-chain nếu có.
- Cung cấp nút register hoặc re-register public key.
- Cung cấp flow rotate key với cảnh báo ảnh hưởng tới các credential đã cấp.
- Cung cấp export/import backup với hướng dẫn bảo quản passphrase.
- Không hiển thị private key, raw passphrase hoặc dữ liệu nhạy cảm trong UI/log.

## 3. Link Sharing UX

### Hiện trạng

Route `/subject-grants` đã có thao tác tạo `LinkGrant`, nhưng secret hiện được hiển thị bằng toast và console. Chưa có shareable URL hoặc route xử lý link.

### Vấn đề

- Người dùng không nhận được URL chia sẻ hoàn chỉnh.
- Full secret được ghi vào console, không phù hợp với production UX.
- Không có nút copy link.
- Không có danh sách link đã tạo.
- Không có thông tin rõ ràng về expiry, max uses, số lần đã sử dụng và trạng thái link.
- Chưa có route `/verify/link/...` cho người nhận link.
- Người dùng khó biết link đã hết hạn, bị revoke hoặc đã hết lượt sử dụng.

### UX cần cải thiện

- Tạo shareable URL sau khi transaction tạo link được xác nhận.
- Có nút copy link và thông báo copy thành công/thất bại.
- Không log full secret vào console.
- Chỉ hiển thị secret/link theo nguyên tắc one-time reveal nếu cần.
- Hiển thị expiry, max uses, use count và trạng thái link.
- Thêm danh sách link theo credential.
- Thêm confirmation trước khi revoke link.
- Thêm route verifier dành cho link không cần wallet.
- Hiển thị các trạng thái link rõ ràng: active, expired, revoked, exhausted, invalid.

## 4. Grant History

### Hiện trạng

Client đã có helper `fetchAccessGrantsForCredential`, nhưng các page subject và issuer chưa cung cấp màn hình lịch sử grant đầy đủ.

### Vấn đề

- Subject không biết credential đang được chia sẻ cho wallet nào.
- Issuer không có góc nhìn về các access grant liên quan tới credential mình đã cấp.
- Không có filter theo active/revoked/expired.
- Không có thông tin thời gian tạo hoặc thời gian hết hạn dễ đọc.
- Không có empty, loading và error state riêng cho grant history.

### UX cần cải thiện

- Hiển thị grant history theo từng credential.
- Phân biệt rõ `AccessGrant` và `LinkGrant`.
- Hiển thị recipient/grantor ở dạng rút gọn nhưng có copy full address.
- Hiển thị status bằng badge và màu nhất quán.
- Hiển thị created time, expiry, key version và use count khi phù hợp.
- Có filter active, revoked, expired và exhausted.
- Có refresh thủ công và tự refresh sau mutation.
- Hiển thị action phù hợp với role của người dùng.
- Không gọi tên “history” nếu dữ liệu chỉ là trạng thái grant hiện tại; audit timeline cần backend/indexer riêng.

## 5. Error And Transaction UX

### Hiện trạng

Các page đã có loading/error state cơ bản và toast thông báo, nhưng cách hiển thị chưa đồng nhất giữa issuer, subject-grants, encryption-setup và verify.

### Vấn đề

- Một số lỗi hiển thị tiếng Anh, một số lỗi hiển thị tiếng Việt.
- Chưa phân biệt lỗi input, wallet rejection, authorization, RPC/network, on-chain program và credential state.
- Người dùng chưa biết transaction đang ở bước nào.
- Chưa có transaction signature hoặc explorer link sau transaction.
- Nhiều action chỉ hiển thị thông báo thất bại chung chung.
- Một số flow có retry, một số flow không có retry.

### UX cần cải thiện

- Chuẩn hóa error categories:
  - Invalid input.
  - Wallet disconnected.
  - User rejected signature.
  - Unauthorized action.
  - Credential revoked/expired.
  - Grant revoked/expired/exhausted.
  - RPC/network failure.
  - Backend registration failure.
  - Unexpected application error.
- Dùng một component hoặc pattern chung cho error state.
- Hiển thị operation name và bước đang chạy.
- Hiển thị retry action khi lỗi có thể thử lại.
- Hiển thị transaction signature và explorer link khi có.
- Giữ raw program error trong phần chi tiết tùy chọn, không đặt làm thông báo chính.
- Không hiển thị private key, passphrase, raw AES key hoặc full wrapped key.

## 6. Mobile And Responsive UX

Các flow grant hiện có nhiều input và action nằm cạnh nhau trên desktop. Cần kiểm tra riêng trên mobile:

- Form wallet address không bị tràn ngang.
- Các nút create/revoke không bị quá nhỏ.
- Grant card có thể đọc được khi address dài.
- Toast không che nội dung quan trọng.
- Confirmation dialog vừa màn hình.
- Bảng/list grant có thể chuyển thành card trên màn hình hẹp.

## 7. Accessibility And Clarity

Các cải thiện nên bao gồm:

- Mỗi input có label rõ ràng và liên kết đúng với control.
- Error message dùng `role="alert"` khi cần thông báo ngay.
- Loading state có text dễ hiểu, không chỉ dựa vào màu sắc.
- Status không chỉ phân biệt bằng màu.
- Các nút destructive như revoke cần confirmation.
- Copy address/link có label và feedback rõ ràng.
- Focus state hoạt động đầy đủ khi thao tác bằng bàn phím.

## Recommended Order

1. Chuẩn hóa error và transaction state cho grant/verification flows.
2. Hoàn thiện verifier setup và wallet public-key registration UX.
3. Thêm AccessGrant history cho subject và issuer.
4. Giảm việc nhập wrapped key thủ công khi identity/public-key metadata đã sẵn sàng.
5. Hoàn thiện LinkGrant shareable URL, copy action và link verification route.
6. Bổ sung responsive/accessibility polish.

## Implementation Status

### 1. Chuẩn hóa error và transaction state

**Partial - implemented:**

- Đã thêm typed operation/error model và component feedback dùng chung.
- Đã phân loại các lỗi wallet rejection, authorization, credential/grant state, RPC/backend và unexpected error.
- Đã thêm các trạng thái preparing, signing, confirming, success và error.
- Đã giữ transaction result ở grant mutation boundary khi wallet client trả về.
- Đã thêm retry cho các lỗi có thể thử lại.
- Đã bảo vệ thông báo khỏi private key, passphrase, raw AES key, secret và wrapped key.

**Deferred:**

- Transaction signature/explorer link chỉ hiển thị khi wallet client thực sự trả về signature.
- Một số flow cũ vẫn cần được migrate hoàn toàn sang shared feedback component.
- Lint còn các warning unused imports tồn tại ở issuer-registry page.

### 2. Verifier setup và wallet public-key registration

**Partial - implemented:**

- `/encryption-setup` đã có connected-wallet state.
- Đã phân biệt local encryption identity với Solana signing wallet.
- Đã có lookup/register/re-register public key theo connected wallet.
- Đã hiển thị backend và on-chain key version.
- Đã cảnh báo khi key version không đồng bộ.
- Đã thêm rotate key, export backup và import backup controls.

**Deferred:**

- Cập nhật on-chain encryption profile sau rotation chưa được tự động hóa trong UX này.
- Partial failure recovery giữa local storage, backend và on-chain profile cần hardening thêm.

### 3. AccessGrant history

**Partial - implemented:**

- `/subject-grants` đã tải AccessGrant theo credential được chọn.
- Đã hiển thị recipient, grantor, key version, created time, expiry và status.
- Đã có loading, empty, error và manual refresh state.
- Đã refresh danh sách sau create/revoke AccessGrant.
- `/issuer` đã có AccessGrant current-state view theo credential.
- AccessGrant cho subject được issuer tạo tự động trong flow issue bằng AES key đang ở memory; subject không cần nhập wrapped key.

**Deferred:**

- Chưa có audit timeline đầy đủ.
- Chưa có LinkGrant history hoặc LinkGrant decoder/fetch mới.
- Revoke confirmation dialog và copy full address action cần polish thêm.
- Tự động tạo wrapped key cho LinkGrant vẫn chưa thực hiện; LinkGrant tiếp tục yêu cầu key riêng vì link sharing là flow khác.

## Out Of Scope

Các nội dung sau không thuộc tài liệu UX này hoặc cần change riêng:

- Backend audit event persistence.
- Grant indexer hoặc event-based historical timeline.
- Deployment, CI/CD, staging và production rollout.
- Feature flags.
- Thay đổi Solana account layout hoặc instruction contract.
- Thay đổi cryptographic algorithm.
- OS keystore/WebAuthn/IndexedDB secure storage implementation.
