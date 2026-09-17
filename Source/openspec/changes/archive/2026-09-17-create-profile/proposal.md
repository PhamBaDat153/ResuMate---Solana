## Why

ResuMate đã có instruction on-chain `create_profile`, nhưng người dùng hiện chưa có luồng end-to-end để phát hiện profile, gửi giao dịch tạo profile và xác nhận trạng thái sau khi giao dịch thành công. Việc hoàn thiện capability này là nền tảng để người dùng tạo resume và nhận credential, đồng thời cần kiểm thử các quy tắc ownership và khởi tạo profile trước khi mở rộng các luồng tiếp theo.

## What Changes

- Bổ sung client layer để derive `UserProfile` PDA theo wallet và tạo giao dịch `create_profile`.
- Bổ sung luồng frontend cho wallet đã kết nối: phát hiện profile đã tồn tại, hiển thị trạng thái và cho phép tạo profile khi account chưa tồn tại.
- Theo dõi việc ký, xác nhận và tải lại profile sau giao dịch; hiển thị lỗi phù hợp cho wallet chưa kết nối, từ chối ký, thiếu phí hoặc giao dịch thất bại.
- Bổ sung kiểm thử cho profile mới, profile đã tồn tại, wallet khác và các giá trị khởi tạo counter.
- Không lưu tên, email, CV hoặc PII trong `UserProfile`; không thay đổi layout hay authorization semantics của smart contract hiện có.

## Capabilities

### New Capabilities

- `profile-creation`: Cho phép Resume Owner tạo và quan sát `UserProfile` PDA của wallet thông qua frontend/client, với các điều kiện và kết quả on-chain có thể kiểm chứng.

### Modified Capabilities

- Không có.

## Impact

- Smart contract: tích hợp và kiểm thử instruction `create_profile` hiện có; không dự kiến thay đổi state layout hoặc instruction interface.
- Frontend: thêm PDA derivation, client instruction/transaction handling và UI state cho profile trong ứng dụng Next.js hiện có.
- Wallet/RPC: sử dụng Wallet Standard qua `@solana/kit`, `@solana/react` và RPC hiện tại; người dùng phải ký giao dịch và trả rent.
- Tests: bổ sung coverage integration/client phù hợp với harness hiện có hoặc test harness Solana được dự án chọn trong giai đoạn triển khai.
