import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    executions: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    step_runs: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    provider_jobs: {
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  adjustUserCreditsInTx: vi.fn(),
  cancelVideoTask: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/oss", () => ({
  getSignedUrl: vi.fn(),
}));
vi.mock("@/services/credit", () => ({
  adjustUserCreditsInTx: mocks.adjustUserCreditsInTx,
}));
vi.mock("@/services/video", () => ({
  cancelVideoTask: mocks.cancelVideoTask,
}));

import { completeStepRun, requestCancelExecution } from "./canvas";

describe("canvas execution cancellation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("immediately cancels a running synchronous step", async () => {
    let executionStatus = "running";
    let stepStatus = "running";

    mocks.prisma.executions.findUnique.mockImplementation(async (args: any) => ({
      id: 41,
      user_id: 7,
      status: executionStatus,
      reserved_credits: 0,
      step_runs: args.include
        ? [
            {
              id: 52,
              status: stepStatus,
              credits_consumed: 0,
              provider_jobs: [],
            },
          ]
        : undefined,
    }));
    mocks.prisma.executions.updateMany.mockImplementation(async (args: any) => {
      if (args.where.status.in.includes(executionStatus)) {
        executionStatus = args.data.status;
        return { count: 1 };
      }
      return { count: 0 };
    });
    mocks.prisma.step_runs.updateMany.mockImplementation(async (args: any) => {
      if (args.where.status.in.includes(stepStatus)) {
        stepStatus = args.data.status;
        return { count: 1 };
      }
      return { count: 0 };
    });
    mocks.prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        executions: {
          updateMany: mocks.prisma.executions.updateMany,
        },
      })
    );

    const result = await requestCancelExecution(41);

    expect(result).toEqual({ ok: true, status: "cancelled" });
    expect(stepStatus).toBe("cancelled");
  });

  it("does not persist a late result after cancellation won the race", async () => {
    let stepStatus = "cancelled";

    mocks.prisma.step_runs.findUnique.mockResolvedValue({ execution_id: 41 });
    mocks.prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        executions: {
          findUnique: vi.fn().mockResolvedValue({
            status: "cancelled",
            user_id: 7,
          }),
          update: vi.fn(),
        },
        step_runs: {
          update: vi.fn(async (args: any) => {
            stepStatus = args.data.status;
          }),
          updateMany: vi.fn(async (args: any) => {
            if (args.where.status === stepStatus) {
              stepStatus = args.data.status;
              return { count: 1 };
            }
            return { count: 0 };
          }),
        },
      })
    );

    await completeStepRun(52, { kind: "image", storageKeys: ["late.png"] }, 7);

    expect(stepStatus).toBe("cancelled");
    expect(mocks.adjustUserCreditsInTx).not.toHaveBeenCalled();
  });
});
