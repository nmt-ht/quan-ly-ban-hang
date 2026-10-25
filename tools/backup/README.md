# Sao lưu và khôi phục cơ sở dữ liệu

Workflow `.github/workflows/backup-db.yml` chạy mỗi ngày lúc 03:17 (giờ Việt Nam) và khi bấm tay
(Actions › Backup DB › Run workflow). Với mỗi database, nó: `pg_dump` Neon → khôi phục thử vào một PostgreSQL tạm
(đếm số người dùng để chắc file dùng được) → mã hoá AES-256 → lưu vào artifact `ninhtrang-db-backup` 30 ngày,
mỗi database một file `<mã>-YYYYMMDD.dump.enc`.

## Cài đặt một lần

Settings › Secrets and variables › Actions › New repository secret:

| Secret | Giá trị |
|---|---|
| `BACKUP_DATABASE_URL` | Chuỗi kết nối **trực tiếp** của Neon. Nên tạo role chỉ đọc cho việc sao lưu. |
| `BACKUP_PASSPHRASE` | Cụm mật khẩu dài, lưu ở nơi an toàn khác (trình quản lý mật khẩu). Mất nó là không giải mã được. |

Repo công khai thì mọi người tải được artifact, nên file luôn mã hoá; thiếu secret thì workflow dừng.

### Nhiều doanh nghiệp

Không đặt `PLATFORM_DATABASE_URL` thì workflow chỉ sao lưu `BACKUP_DATABASE_URL` (file `ninhtrang-YYYYMMDD.dump.enc`).
Khi bật nhiều doanh nghiệp, thêm:

| Secret | Giá trị |
|---|---|
| `PLATFORM_DATABASE_URL` | Giống trên Render. Database nền tảng được sao lưu thành `_platform-YYYYMMDD.dump.enc`. |
| `PLATFORM_SECRET` | Giống trên Render. Dùng để giải mã chuỗi kết nối của từng doanh nghiệp trong bảng `platform_tenant`. |

Workflow đọc các doanh nghiệp `ACTIVE` và `SUSPENDED`, giải mã chuỗi kết nối bằng [`tenant-urls.mjs`](tenant-urls.mjs)
(che chuỗi kết nối và mật khẩu khỏi log bằng `::add-mask::`) rồi sao lưu từng database thành `<mã>-YYYYMMDD.dump.enc`.
Doanh nghiệp ở `BACKUP_DATABASE_URL` được sao lưu bằng chuỗi đó (role chỉ đọc) thay cho chuỗi lưu trong bảng; mã của nó
lấy từ biến `DEFAULT_TENANT_CODE` (Settings › Secrets and variables › Actions › Variables, mặc định `ninhtrang`), phải
trùng với `DEFAULT_TENANT_CODE` trên Render. Không có `BACKUP_DATABASE_URL` thì mọi doanh nghiệp đều lấy từ bảng.

Một database lỗi (không kết nối được, khôi phục thử thất bại, không có người dùng) không chặn các database khác:
các file đã xong vẫn được tải lên, rồi lần chạy được đánh dấu thất bại để GitHub gửi thông báo.

Mỗi doanh nghiệp được tạo trên nền tảng có admin ban đầu nên luôn có ít nhất một người dùng; database nền tảng được
kiểm tra bằng số dòng của `platform_tenant`.

## Khôi phục

```bash
# 1. Tải artifact ninhtrang-db-backup từ lần chạy muốn dùng, giải nén, chọn file <mã>-YYYYMMDD.dump.enc
# 2. Giải mã
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in ninhtrang-YYYYMMDD.dump.enc -out backup.dump
# 3. Khôi phục vào một database TRỐNG (tạo mới trên Neon hoặc local), không bao giờ vào DB đang chạy
pg_restore --no-owner --dbname "$TARGET_DATABASE_URL" backup.dump
# 4. Trỏ DATABASE_URL của Render sang database mới, hoặc kiểm tra số liệu rồi mới chuyển
```

Với một doanh nghiệp khác `DATABASE_URL`: Quản trị nền tảng chưa có chỗ đổi chuỗi kết nối, nên khôi phục vào đúng
database cũ (`nt_<mã>`) sau khi xoá và tạo lại nó trống trên cùng máy chủ; kiểm tra trên một database tạm trước. Mất database nền tảng: khôi phục file `_platform-…` vào database mới và trỏ
`PLATFORM_DATABASE_URL` sang đó (cần đúng `PLATFORM_SECRET` cũ để đọc được chuỗi kết nối đã lưu).

## Nên thử khôi phục định kỳ

Mỗi quý: khôi phục bản mới nhất vào một database tạm và đăng nhập thử. Sao lưu chưa từng khôi phục thì chưa phải sao lưu.

Neon còn có khôi phục theo thời điểm (branch từ lịch sử) nhưng cửa sổ lưu của gói miễn phí ngắn; bản sao lưu ở đây là lớp dự phòng dài hơn.
