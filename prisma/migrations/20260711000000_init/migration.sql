-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PartyRole" AS ENUM ('FREELANCER', 'CLIENT');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'PHP');

-- CreateEnum
CREATE TYPE "TimeoutDefault" AS ENUM ('AUTO_RELEASE', 'AUTO_REFUND');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'AWAITING_PAYMENT', 'FUNDED', 'PARTIALLY_RELEASED', 'COMPLETED', 'EXPIRED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('LOCKED', 'AWAITING_APPROVAL', 'RELEASED', 'REFUNDED', 'EXPIRED_RELEASED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('FUND', 'RELEASE', 'CONVERT', 'CASHOUT', 'REFUND');

-- CreateTable
CREATE TABLE "parties" (
    "id" TEXT NOT NULL,
    "role" "PartyRole" NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "walletAddress" TEXT,
    "circleWalletId" TEXT,
    "receiveCurrency" "Currency" NOT NULL DEFAULT 'PHP',
    "balanceMinor" BIGINT NOT NULL DEFAULT 0,
    "gcashHandle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "payeeId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT NOT NULL,
    "payerId" TEXT,
    "amountMinor" BIGINT NOT NULL,
    "billingCurrency" "Currency" NOT NULL DEFAULT 'USD',
    "receiveCurrency" "Currency" NOT NULL DEFAULT 'PHP',
    "escrow" BOOLEAN NOT NULL DEFAULT false,
    "timeoutDays" INTEGER NOT NULL DEFAULT 7,
    "timeoutDefault" "TimeoutDefault" NOT NULL DEFAULT 'AUTO_RELEASE',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "payToken" TEXT,
    "contractInvoiceId" TEXT,
    "fxQuoteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fundedAt" TIMESTAMP(3),

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestones" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "idx" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'LOCKED',
    "releaseTxHash" TEXT,
    "releasedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "milestoneId" TEXT,
    "type" "TransactionType" NOT NULL,
    "txHash" TEXT,
    "amountMinor" BIGINT NOT NULL,
    "currency" "Currency" NOT NULL,
    "fxRate" DOUBLE PRECISION,
    "externalRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fx_quotes" (
    "id" TEXT NOT NULL,
    "fromCurrency" "Currency" NOT NULL DEFAULT 'USD',
    "toCurrency" "Currency" NOT NULL DEFAULT 'PHP',
    "rate" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fx_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "parties_email_key" ON "parties"("email");

-- CreateIndex
CREATE UNIQUE INDEX "parties_walletAddress_key" ON "parties"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "parties_circleWalletId_key" ON "parties"("circleWalletId");

-- CreateIndex
CREATE INDEX "parties_role_idx" ON "parties"("role");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_payToken_key" ON "invoices"("payToken");

-- CreateIndex
CREATE INDEX "invoices_payeeId_idx" ON "invoices"("payeeId");

-- CreateIndex
CREATE INDEX "invoices_payerId_idx" ON "invoices"("payerId");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "milestones_invoiceId_status_idx" ON "milestones"("invoiceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "milestones_invoiceId_idx_key" ON "milestones"("invoiceId", "idx");

-- CreateIndex
CREATE INDEX "transactions_invoiceId_type_idx" ON "transactions"("invoiceId", "type");

-- CreateIndex
CREATE INDEX "transactions_milestoneId_idx" ON "transactions"("milestoneId");

-- CreateIndex
CREATE INDEX "fx_quotes_validUntil_idx" ON "fx_quotes"("validUntil");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payeeId_fkey" FOREIGN KEY ("payeeId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_fxQuoteId_fkey" FOREIGN KEY ("fxQuoteId") REFERENCES "fx_quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

