ALTER TABLE "users"
    ALTER COLUMN "credits" SET DEFAULT 50,
    DROP COLUMN "plan",
    DROP COLUMN "subscriptionStatus",
    DROP COLUMN "subscriptionEndsAt";

ALTER TABLE "payment_transactions"
    ALTER COLUMN "type" TYPE TEXT USING "type"::text;

DROP TYPE "SubscriptionStatus";
DROP TYPE "Plan";
DROP TYPE "PaymentType";
