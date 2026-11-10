export interface EscrowHoldParams {
  sessionId: string;
  learnerId: string;
  creditAmount: number;
}

export interface EscrowReleaseParams {
  sessionId: string;
  teacherId: string;
  learnerId: string;
  creditAmount: number;
  actualDurationHours?: number;
}

export interface EscrowRefundParams {
  sessionId: string;
  learnerId: string;
  creditAmount: number;
  reason: string;
}

export interface LedgerOperationResult {
  success: boolean;
  transactionId: string;
  learnerBalanceAfter?: number;
  teacherBalanceAfter?: number;
  message: string;
}

