import { Module } from '@nestjs/common';
import { CashVouchersModule } from './cash-vouchers.module.js';
import { CashTransfersController, CashTransfersService } from './cash-transfers.js';
import { CashCountsController, CashCountsService } from './cash-counts.js';
import { BankReconciliationController, BankReconciliationService } from './bank-reconciliation.js';

/** Chuyển tiền nội bộ, kiểm kê quỹ và đối chiếu sao kê ngân hàng — dựng trên phiếu thu chi của CashVouchersModule. */
@Module({
  imports: [CashVouchersModule],
  controllers: [CashTransfersController, CashCountsController, BankReconciliationController],
  providers: [CashTransfersService, CashCountsService, BankReconciliationService],
})
export class CashOpsModule {}
