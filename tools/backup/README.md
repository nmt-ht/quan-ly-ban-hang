# Sao lưu và khôi phục cơ sở dữ liệu

Workflow `.github/workflows/backup-db.yml` chạy mỗi ngày lúc 03:17 (giờ Việt Nam) và khi bấm tay
(Actions › Backup DB › Run workflow). Mỗi lần nó: `pg_dump` Neon → khôi phục thử vào một PostgreSQL tạm
(đếm số người dùng để chắc file dùng được) → mã hoá AES-256 → lưu artifact 30 ngày.

## Cài đặt một lần

Settings › Secrets and variables › Actions › New repository secret:

| Secret | Giá trị |
|---|---|
| `BACKUP_DATABASE_URL` | Chuỗi kết nối **trực tiếp** của Neon. Nên tạo role chỉ đọc cho việc sao lưu. |
| `BACKUP_PASSPHRASE` | Cụm mật khẩu dài, lưu ở nơi an toàn khác (trình quản lý mật khẩu). Mất nó là không giải mã được. |

Repo công khai thì mọi người tải được artifact, nên file luôn mã hoá; thiếu secret thì workflow dừng.

## Khôi phục

```bash
# 1. Tải artifact ninhtrang-db-backup từ lần chạy muốn dùng, giải nén ra file ninhtrang-YYYYMMDD.dump.enc
# 2. Giải mã
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in ninhtrang-YYYYMMDD.dump.enc -out backup.dump
# 3. Khôi phục vào một database TRỐNG (tạo mới trên Neon hoặc local), không bao giờ vào DB đang chạy
pg_restore --no-owner --dbname "$TARGET_DATABASE_URL" backup.dump
# 4. Trỏ DATABASE_URL của Render sang database mới, hoặc kiểm tra số liệu rồi mới chuyển
```

## Nên thử khôi phục định kỳ

Mỗi quý: khôi phục bản mới nhất vào một database tạm và đăng nhập thử. Sao lưu chưa từng khôi phục thì chưa phải sao lưu.

Neon còn có khôi phục theo thời điểm (branch từ lịch sử) nhưng cửa sổ lưu của gói miễn phí ngắn; bản sao lưu ở đây là lớp dự phòng dài hơn.
