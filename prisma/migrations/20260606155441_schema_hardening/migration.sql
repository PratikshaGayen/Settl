-- CreateIndex
CREATE INDEX "fx_quotes_validUntil_idx" ON "fx_quotes"("validUntil");

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
CREATE UNIQUE INDEX "parties_email_key" ON "parties"("email");

-- CreateIndex
CREATE UNIQUE INDEX "parties_walletAddress_key" ON "parties"("walletAddress");

-- CreateIndex
CREATE INDEX "parties_role_idx" ON "parties"("role");

-- CreateIndex
CREATE INDEX "transactions_invoiceId_type_idx" ON "transactions"("invoiceId", "type");

-- CreateIndex
CREATE INDEX "transactions_milestoneId_idx" ON "transactions"("milestoneId");
