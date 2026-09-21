## Why

Việc chia sẻ credential qua LinkGrant yêu cầu xử lý secret và wrapped key phức tạp, trong khi luồng verify trực tiếp qua AccessGrant đã đáp ứng nhu cầu kiểm tra credential. Để giảm bề mặt bảo mật và đơn giản hóa trải nghiệm, Share Link được loại khỏi giao diện nhưng dữ liệu và contract on-chain cũ vẫn được giữ tương thích.

## What Changes

- Xóa UI tạo, liệt kê và thu hồi Share Link khỏi `subject-grants`.
- Xóa route xác minh bằng Share Link và tùy chọn tạo secret link trong cổng issuer.
- Giữ nguyên LinkGrant instruction, account decoder, crypto helper và dữ liệu on-chain cũ để không phá các account đã tồn tại.
- Giữ luồng verify trực tiếp bằng credential address, connected verifier wallet và AccessGrant.

## Capabilities

### New Capabilities

Không có. Đây là thay đổi loại bỏ trải nghiệm người dùng, không thêm capability runtime mới.

### Modified Capabilities

Không có. Contract on-chain và capability verify trực tiếp không thay đổi.

## Impact

- `FE/app/subject-grants/page.tsx`: chỉ còn hiển thị AccessGrant.
- `FE/app/issuer/page.tsx`: bỏ tùy chọn tạo secret link sau khi cấp credential.
- `FE/app/verify/link/[credentialAddress]/[grantId]/page.tsx`: xóa route UI Share Link.
- `FE/lib/subjectShare.ts`: xóa helper tự động tạo link chưa hoàn thiện.
- `FE/lib/grantProgram.ts`, crypto helpers và Solana program: giữ nguyên để tương thích dữ liệu on-chain cũ.
- Không có migration account, thay đổi instruction, backend persistence mới hoặc dependency mới.
