import { PrismaClient, type Prisma } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

async function runDatabaseOperation<T>(
  operation: string,
  action: () => Promise<T>,
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown database error";
    throw new Error(`Unable to ${operation}: ${detail}`);
  }
}

export function getUserByEmail(email: string) {
  return runDatabaseOperation("get user by email", () =>
    prisma.user.findUnique({ where: { email } }),
  );
}

export function createUser(data: Prisma.UserCreateInput) {
  return runDatabaseOperation("create user", () => prisma.user.create({ data }));
}

export function getExamById(id: string) {
  return runDatabaseOperation("get exam by ID", () =>
    prisma.exam.findUnique({ where: { id } }),
  );
}

export function createExam(data: Prisma.ExamCreateInput) {
  return runDatabaseOperation("create exam", () => prisma.exam.create({ data }));
}

export function createScript(data: Prisma.ScriptCreateInput) {
  return runDatabaseOperation("create script", () => prisma.script.create({ data }));
}

export function updateScriptStatus(id: string, status: string) {
  return runDatabaseOperation("update script status", () =>
    prisma.script.update({ where: { id }, data: { status } }),
  );
}

export function createGrade(data: Prisma.GradeCreateInput) {
  return runDatabaseOperation("create grade", () => prisma.grade.create({ data }));
}

export function deductCredits(userId: string, amount: number, description: string) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Credit deduction amount must be a positive integer");
  }

  return runDatabaseOperation("deduct credits", () =>
    prisma.$transaction(async (transaction) => {
      const result = await transaction.user.updateMany({
        where: { id: userId, credits: { gte: amount } },
        data: { credits: { decrement: amount } },
      });

      if (result.count === 0) {
        throw new Error("User not found or insufficient credits");
      }

      return transaction.creditTransaction.create({
        data: {
          userId,
          amount: -amount,
          type: "deduction",
          description,
        },
      });
    }),
  );
}

export * from "@prisma/client";