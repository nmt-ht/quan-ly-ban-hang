-- Tài khoản hệ thống (seed TT133) không cho sửa cấu trúc / xoá; tài khoản người dùng tự thêm thì được.
ALTER TABLE "Account" ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false;

-- Mọi tài khoản đang có đều là tài khoản chuẩn.
UPDATE "Account" SET "isSystem" = true;
