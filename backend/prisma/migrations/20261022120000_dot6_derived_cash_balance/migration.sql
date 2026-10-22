-- Keep every account's current balance: whatever the stored balance held beyond its vouchers moves into
-- the opening balance, from which the balance is derived from now on.
UPDATE "CashAccount" a SET "openingBalance" = a."balance" - COALESCE((
  SELECT SUM(CASE WHEN v."kind" = 'THU' THEN v."amount" ELSE -v."amount" END)
  FROM "CashVoucher" v WHERE v."accountId" = a."id" AND NOT v."isCancelled"
), 0);

-- AlterTable
ALTER TABLE "CashAccount" DROP COLUMN "balance";

