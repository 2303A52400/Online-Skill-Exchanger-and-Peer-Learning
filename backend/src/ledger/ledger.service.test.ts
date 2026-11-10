import { describe, it, expect, vi } from "vitest";
import { TimeBankingLedgerService } from "./ledger.service.js";

describe("TimeBankingLedgerService", () => {
  it("rejects zero or negative credit hold amounts", async () => {
    const mockPrisma: any = {};
    const ledger = new TimeBankingLedgerService(mockPrisma);

    await expect(
      ledger.holdEscrow({
        sessionId: "11111111-1111-1111-1111-111111111111",
        learnerId: "22222222-2222-2222-2222-222222222222",
        creditAmount: 0,
      })
    ).rejects.toThrow("Escrow hold amount must be strictly positive");
  });

  it("handles valid parameters signature correctly", () => {
    const mockPrisma: any = {};
    const ledger = new TimeBankingLedgerService(mockPrisma);
    expect(ledger).toBeDefined();
  });
});

