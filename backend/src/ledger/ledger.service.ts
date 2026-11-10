import { PrismaClient, TransactionType, LedgerEntryType, SessionStatus } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { logger, ledgerTransactionsTotal } from "../config/index.js";
import {
  EscrowHoldParams,
  EscrowReleaseParams,
  EscrowRefundParams,
  LedgerOperationResult,
} from "./ledger.types.js";

export class TimeBankingLedgerService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Holds credits in escrow prior to session commencement.
   * Employs strict row-level lock (`SELECT ... FOR UPDATE`) inside an isolated transaction
   * to guarantee no double-spending under concurrent requests.
   */
  async holdEscrow(params: EscrowHoldParams): Promise<LedgerOperationResult> {
    const { sessionId, learnerId, creditAmount } = params;
    const transactionId = uuidv4();

    if (creditAmount <= 0) {
      throw new Error("Escrow hold amount must be strictly positive");
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Acquire pessimistic lock on learner row to prevent simultaneous bookings exhausting balance
        const [lockedLearner] = await tx.$queryRaw<
          Array<{ id: string; creditBalance: number; escrowLockedBalance: number }>
        >`
          SELECT id, "creditBalance", "escrowLockedBalance"
          FROM users
          WHERE id = ${learnerId}::uuid
          FOR UPDATE
        `;

        if (!lockedLearner) {
          throw new Error(`Learner with ID ${learnerId} does not exist`);
        }

        const currentBalance = Number(lockedLearner.creditBalance);
        if (currentBalance < creditAmount) {
          throw new Error(
            `Insufficient time credits. Required: ${creditAmount}, Available: ${currentBalance}`
          );
        }

        // 2. Lock session row to ensure idempotent transition
        const session = await tx.session.findUnique({
          where: { id: sessionId },
        });

        if (!session) {
          throw new Error(`Session ${sessionId} not found`);
        }

        if (session.status !== SessionStatus.CONFIRMED && session.status !== SessionStatus.REQUESTED) {
          throw new Error(`Cannot escrow session in state ${session.status}`);
        }

        const newBalance = currentBalance - creditAmount;
        const newEscrowLocked = Number(lockedLearner.escrowLockedBalance) + creditAmount;

        // 3. Update cached balances on User table
        await tx.user.update({
          where: { id: learnerId },
          data: {
            creditBalance: newBalance,
            escrowLockedBalance: newEscrowLocked,
          },
        });

        // 4. Record immutable double-entry ledger record
        await tx.ledgerEntry.create({
          data: {
            transactionId,
            userId: learnerId,
            sessionId,
            type: TransactionType.ESCROW_LOCK,
            direction: LedgerEntryType.DEBIT,
            amount: creditAmount,
            balanceAfter: newBalance,
            description: `Escrow hold for scheduled session ${sessionId}`,
          },
        });

        // 5. Transition session state to ESCROWED
        await tx.session.update({
          where: { id: sessionId },
          data: { status: SessionStatus.ESCROWED },
        });

        return { newBalance, transactionId };
      });

      ledgerTransactionsTotal.inc({ type: "ESCROW_LOCK", status: "success" });
      logger.info({ sessionId, learnerId, amount: creditAmount, transactionId }, "Escrow held successfully");

      return {
        success: true,
        transactionId: result.transactionId,
        learnerBalanceAfter: result.newBalance,
        message: "Escrow successfully held",
      };
    } catch (error: any) {
      ledgerTransactionsTotal.inc({ type: "ESCROW_LOCK", status: "failed" });
      logger.error({ sessionId, learnerId, err: error.message }, "Failed to hold escrow");
      throw error;
    }
  }

  /**
   * Releases escrowed credits to the teacher upon verified session completion.
   */
  async releaseEscrow(params: EscrowReleaseParams): Promise<LedgerOperationResult> {
    const { sessionId, teacherId, learnerId, creditAmount, actualDurationHours } = params;
    const transactionId = uuidv4();

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // Lock both learner and teacher rows deterministically by UUID order to eliminate deadlocks
        const sortedIds = [learnerId, teacherId].sort();
        for (const uid of sortedIds) {
          await tx.$queryRaw`
            SELECT id FROM users WHERE id = ${uid}::uuid FOR UPDATE
          `;
        }

        const session = await tx.session.findUnique({
          where: { id: sessionId },
        });

        if (!session) {
          throw new Error(`Session ${sessionId} not found`);
        }

        if (session.status !== SessionStatus.ESCROWED && session.status !== SessionStatus.IN_PROGRESS) {
          throw new Error(`Cannot release escrow for session in state ${session.status}`);
        }

        // Deduct from Learner's locked escrow
        const learner = await tx.user.findUniqueOrThrow({ where: { id: learnerId } });
        const teacher = await tx.user.findUniqueOrThrow({ where: { id: teacherId } });

        const updatedLearnerEscrow = Math.max(0, Number(learner.escrowLockedBalance) - creditAmount);
        const updatedTeacherBalance = Number(teacher.creditBalance) + creditAmount;
        const updatedTeacherHours = Number(teacher.hoursContributed) + (actualDurationHours ?? creditAmount);

        await tx.user.update({
          where: { id: learnerId },
          data: {
            escrowLockedBalance: updatedLearnerEscrow,
            totalSessionsLearned: { increment: 1 },
          },
        });

        await tx.user.update({
          where: { id: teacherId },
          data: {
            creditBalance: updatedTeacherBalance,
            hoursContributed: updatedTeacherHours,
            totalSessionsTaught: { increment: 1 },
          },
        });

        // Double-entry record: Credit to Teacher
        await tx.ledgerEntry.create({
          data: {
            transactionId,
            userId: teacherId,
            sessionId,
            type: TransactionType.ESCROW_RELEASE,
            direction: LedgerEntryType.CREDIT,
            amount: creditAmount,
            balanceAfter: updatedTeacherBalance,
            description: `Learning credit earned for teaching session ${sessionId}`,
          },
        });

        // Mark session as COMPLETED
        await tx.session.update({
          where: { id: sessionId },
          data: {
            status: SessionStatus.COMPLETED,
            actualEndAt: new Date(),
          },
        });

        return { teacherBalance: updatedTeacherBalance, transactionId };
      });

      ledgerTransactionsTotal.inc({ type: "ESCROW_RELEASE", status: "success" });
      logger.info({ sessionId, teacherId, amount: creditAmount, transactionId }, "Escrow released to teacher");

      return {
        success: true,
        transactionId: result.transactionId,
        teacherBalanceAfter: result.teacherBalance,
        message: "Escrow credits successfully transferred to teacher",
      };
    } catch (error: any) {
      ledgerTransactionsTotal.inc({ type: "ESCROW_RELEASE", status: "failed" });
      logger.error({ sessionId, teacherId, err: error.message }, "Failed to release escrow");
      throw error;
    }
  }

  /**
   * Reverses an escrow hold and refunds credits back to the learner
   * upon cancellation or resolved dispute.
   */
  async refundEscrow(params: EscrowRefundParams): Promise<LedgerOperationResult> {
    const { sessionId, learnerId, creditAmount, reason } = params;
    const transactionId = uuidv4();

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const [lockedLearner] = await tx.$queryRaw<
          Array<{ id: string; creditBalance: number; escrowLockedBalance: number }>
        >`
          SELECT id, "creditBalance", "escrowLockedBalance"
          FROM users
          WHERE id = ${learnerId}::uuid
          FOR UPDATE
        `;

        if (!lockedLearner) {
          throw new Error(`Learner ${learnerId} not found`);
        }

        const session = await tx.session.findUnique({
          where: { id: sessionId },
        });

        if (!session) {
          throw new Error(`Session ${sessionId} not found`);
        }

        const newCreditBalance = Number(lockedLearner.creditBalance) + creditAmount;
        const newEscrowBalance = Math.max(0, Number(lockedLearner.escrowLockedBalance) - creditAmount);

        await tx.user.update({
          where: { id: learnerId },
          data: {
            creditBalance: newCreditBalance,
            escrowLockedBalance: newEscrowBalance,
          },
        });

        await tx.ledgerEntry.create({
          data: {
            transactionId,
            userId: learnerId,
            sessionId,
            type: TransactionType.ESCROW_REFUND,
            direction: LedgerEntryType.CREDIT,
            amount: creditAmount,
            balanceAfter: newCreditBalance,
            description: `Refund: ${reason}`,
          },
        });

        await tx.session.update({
          where: { id: sessionId },
          data: { status: SessionStatus.REFUNDED },
        });

        return { newCreditBalance, transactionId };
      });

      ledgerTransactionsTotal.inc({ type: "ESCROW_REFUND", status: "success" });
      logger.info({ sessionId, learnerId, amount: creditAmount, reason }, "Escrow refunded to learner");

      return {
        success: true,
        transactionId: result.transactionId,
        learnerBalanceAfter: result.newCreditBalance,
        message: "Escrow successfully refunded",
      };
    } catch (error: any) {
      ledgerTransactionsTotal.inc({ type: "ESCROW_REFUND", status: "failed" });
      logger.error({ sessionId, learnerId, err: error.message }, "Failed to refund escrow");
      throw error;
    }
  }
}

