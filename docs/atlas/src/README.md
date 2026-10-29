# Nguồn tài liệu Atlas

Mỗi file `ATL-xx_*.md` ở đây là nguồn của một tài liệu `docs/atlas/ATL-xx_*.docx`. Sửa nội dung ở file `.md` rồi dựng lại:

```bash
node tools/atlas/build.mjs          # dựng mọi tài liệu
node tools/atlas/build.mjs ATL-12   # chỉ tài liệu có mã bắt đầu như vậy
```

Không cần cài thêm gói nào. Đừng sửa thẳng file `.docx`: lần dựng sau sẽ ghi đè.

## Cú pháp

| Viết | Ra |
|---|---|
| Khối `---` đầu file | `title:` là tên tài liệu; các dòng còn lại thành bảng thông tin đầu tài liệu (Mã tài liệu, Phân hệ, Đường dẫn, Phiên bản, Hệ thống). |
| `# 1. Tổng quan` / `## Mục đích` | Mục lớn / mục nhỏ. |
| Dòng thường | Đoạn văn. |
| `- …` / `1. …` | Gạch đầu dòng / danh sách số (mỗi danh sách đánh số lại từ 1). |
| `> …` | Ghi chú in nghiêng. |
| `[flow] A → B → C` | Hàng hộp quy trình nối bằng mũi tên. |
| `[next]` | Dòng "↓ tiếp theo" giữa hai hàng hộp. |
| Bảng Markdown có dòng `\|---\|` | Bảng có hàng tiêu đề tô màu. `[table-noheader]` ngay trước bảng thì không có hàng tiêu đề. |
| `**chữ**`, `<br>` | Chữ đậm; xuống dòng trong ô bảng. |

Khi thêm tài liệu mới: đặt tên `ATL-xx_Ten-khong-dau.md`, thêm một dòng vào chỉ mục ở mục 8 của `ATL-00_Workflow-he-thong.md`, tăng `Phiên bản` của các tài liệu đã sửa.
