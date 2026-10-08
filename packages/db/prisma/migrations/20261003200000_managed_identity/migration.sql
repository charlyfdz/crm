ALTER TABLE "member" ADD COLUMN "suspendedAt" TIMESTAMP(3);

CREATE TABLE "identityAuditEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "actorUserId" TEXT,
    "targetUserId" TEXT NOT NULL,
    "previousRole" TEXT,
    "nextRole" TEXT,
    "previousSuspended" BOOLEAN,
    "nextSuspended" BOOLEAN,
    "reason" TEXT,
    CONSTRAINT "identityAuditEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "identityAuditEvent_action_check" CHECK (
      "action" IN ('PROVISION_USER', 'CHANGE_ROLE', 'SUSPEND_USER', 'REACTIVATE_USER', 'RESET_PASSWORD')
    )
);
CREATE INDEX "identityAuditEvent_createdAt_id_idx" ON "identityAuditEvent"("createdAt", "id");
CREATE INDEX "identityAuditEvent_targetUserId_createdAt_idx" ON "identityAuditEvent"("targetUserId", "createdAt");

CREATE FUNCTION "protect_identity_audit"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Identity audit events are append-only';
END;
$$;
CREATE TRIGGER "identityAuditEvent_append_only"
  BEFORE UPDATE OR DELETE ON "identityAuditEvent"
  FOR EACH ROW EXECUTE FUNCTION "protect_identity_audit"();
