ALTER TABLE "activity" ADD COLUMN "assigneeId" TEXT;
ALTER TABLE "activity" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0;
UPDATE "activity" SET "assigneeId" = "createdById" WHERE "type" = 'TASK';
ALTER TABLE "activity" ADD CONSTRAINT "activity_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "activity" ADD CONSTRAINT "activity_priority_bounds" CHECK ("priority" >= 0 AND "priority" <= 3);
CREATE INDEX "activity_assigneeId_completedAt_dueAt_idx" ON "activity"("assigneeId", "completedAt", "dueAt");
