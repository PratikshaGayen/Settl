-- CreateTable
CREATE TABLE "parties" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "walletAddress" TEXT,
    "receiveCurrency" TEXT NOT NULL DEFAULT 'PHP',
    "balanceMinor" BIGINT NOT NULL DEFAULT 0,
    "gcashHandle" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payeeId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT NOT NULL,
    "payerId" TEXT,
    "amountMinor" BIGINT NOT NULL,
    "billingCurrency" TEXT NOT NULL DEFAULT 'USD',
    "receiveCurrency" TEXT NOT NULL DEFAULT 'PHP',
    "escrow" BOOLEAN NOT NULL DEFAULT false,
    "timeoutDays" INTEGER NOT NULL DEFAULT 7,
    "timeoutDefault" TEXT NOT NULL DEFAULT 'AUTO_RELEASE',
    "status" TEXT NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "payToken" TEXT,
    "contractInvoiceId" TEXT,
    "fxQuoteId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fundedAt" DATETIME,
    CONSTRAINT "invoices_payeeId_fkey" FOREIGN KEY ("payeeId") REFERENCES "parties" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "invoices_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "parties" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "invoices_fxQuoteId_fkey" FOREIGN KEY ("fxQuoteId") REFERENCES "fx_quotes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "milestones" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "idx" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'LOCKED',
    "releaseTxHash" TEXT,
    "releasedAt" DATETIME,
    "deliveredAt" DATETIME,
    CONSTRAINT "milestones_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "milestoneId" TEXT,
    "type" TEXT NOT NULL,
    "txHash" TEXT,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "fxRate" REAL,
    "externalRef" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "transactions_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "transactions_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "milestones" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "fx_quotes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromCurrency" TEXT NOT NULL DEFAULT 'USD',
    "toCurrency" TEXT NOT NULL DEFAULT 'PHP',
    "rate" REAL NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_payToken_key" ON "invoices"("payToken");
