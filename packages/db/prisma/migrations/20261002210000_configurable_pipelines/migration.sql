CREATE TYPE "DealOutcome" AS ENUM ('OPEN', 'WON', 'LOST', 'DISQUALIFIED');

CREATE TABLE "pipeline" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pipeline_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pipeline_nameKey_key" ON "pipeline"("nameKey");
CREATE UNIQUE INDEX "pipeline_one_default" ON "pipeline"("isDefault") WHERE "isDefault" = true;

CREATE TABLE "pipelineStage" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "outcome" "DealOutcome" NOT NULL,
    "legacyStage" "DealStage" NOT NULL,
    "archivedAt" TIMESTAMP(3),
    CONSTRAINT "pipelineStage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pipelineStage_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "pipeline"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "pipelineStage_pipelineId_nameKey_key" ON "pipelineStage"("pipelineId", "nameKey");
CREATE INDEX "pipelineStage_pipelineId_position_idx" ON "pipelineStage"("pipelineId", "position");

INSERT INTO "pipeline" ("id", "name", "nameKey", "isDefault", "updatedAt")
VALUES ('pipeline-default', 'Proceso comercial inicial', 'proceso comercial inicial', true, CURRENT_TIMESTAMP);
INSERT INTO "pipelineStage" ("id", "pipelineId", "name", "nameKey", "position", "outcome", "legacyStage") VALUES
('stage-DEMO_BOOKED', 'pipeline-default', 'Contacto inicial', 'contacto inicial', 0, 'OPEN', 'DEMO_BOOKED'),
('stage-QUALIFIED_TO_BUY', 'pipeline-default', 'Calificación', 'calificación', 1, 'OPEN', 'QUALIFIED_TO_BUY'),
('stage-DECISION_MAKER_BOUGHT_IN', 'pipeline-default', 'Validación', 'validación', 2, 'OPEN', 'DECISION_MAKER_BOUGHT_IN'),
('stage-CONTRACT_SENT', 'pipeline-default', 'Propuesta', 'propuesta', 3, 'OPEN', 'CONTRACT_SENT'),
('stage-CLOSED_WON', 'pipeline-default', 'Ganado', 'ganado', 4, 'WON', 'CLOSED_WON'),
('stage-CLOSED_LOST', 'pipeline-default', 'Perdido', 'perdido', 5, 'LOST', 'CLOSED_LOST'),
('stage-UNQUALIFIED_TO_BUY', 'pipeline-default', 'Descalificado', 'descalificado', 6, 'DISQUALIFIED', 'UNQUALIFIED_TO_BUY');

ALTER TABLE "deal" ADD COLUMN "pipelineStageId" TEXT;
UPDATE "deal" SET "pipelineStageId" = 'stage-' || "stage"::text;
CREATE INDEX "deal_pipelineStageId_idx" ON "deal"("pipelineStageId");
ALTER TABLE "deal" ADD CONSTRAINT "deal_pipelineStageId_fkey" FOREIGN KEY ("pipelineStageId") REFERENCES "pipelineStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "crm_deal_pipeline_stage"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE selected_stage "pipelineStage"%ROWTYPE;
DECLARE requested_outcome "DealOutcome";
BEGIN
    IF NEW."pipelineStageId" IS NULL THEN
        requested_outcome := CASE NEW."stage"
            WHEN 'CLOSED_WON' THEN 'WON'::"DealOutcome"
            WHEN 'CLOSED_LOST' THEN 'LOST'::"DealOutcome"
            WHEN 'UNQUALIFIED_TO_BUY' THEN 'DISQUALIFIED'::"DealOutcome"
            ELSE 'OPEN'::"DealOutcome"
        END;
        SELECT ps.* INTO selected_stage FROM "pipelineStage" ps
        JOIN "pipeline" p ON p."id" = ps."pipelineId"
        WHERE p."isDefault" = true AND p."archivedAt" IS NULL AND ps."archivedAt" IS NULL
          AND ps."outcome" = requested_outcome
        ORDER BY (ps."legacyStage" = NEW."stage") DESC, ps."position", ps."id" LIMIT 1;
    ELSE
        SELECT * INTO selected_stage FROM "pipelineStage" WHERE "id" = NEW."pipelineStageId";
    END IF;
    IF selected_stage."id" IS NULL THEN RAISE EXCEPTION 'No valid pipeline stage'; END IF;
    IF TG_OP = 'INSERT' OR NEW."pipelineStageId" IS DISTINCT FROM OLD."pipelineStageId" THEN
        IF selected_stage."archivedAt" IS NOT NULL OR EXISTS (
            SELECT 1 FROM "pipeline" WHERE "id" = selected_stage."pipelineId" AND "archivedAt" IS NOT NULL
        ) THEN RAISE EXCEPTION 'Pipeline stage is archived'; END IF;
    END IF;
    IF TG_OP = 'UPDATE' AND NEW."pipelineStageId" IS NOT DISTINCT FROM OLD."pipelineStageId"
       AND NEW."stage" IS DISTINCT FROM OLD."stage" AND NEW."stage" != selected_stage."legacyStage" THEN
        RAISE EXCEPTION 'Change pipelineStageId instead of the legacy stage';
    END IF;
    NEW."pipelineStageId" := selected_stage."id";
    NEW."stage" := selected_stage."legacyStage";
    RETURN NEW;
END;
$$;
CREATE TRIGGER "deal_pipeline_stage_guard" BEFORE INSERT OR UPDATE OF "pipelineStageId", "stage" ON "deal"
FOR EACH ROW EXECUTE FUNCTION "crm_deal_pipeline_stage"();

CREATE TABLE "dealStageChange" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "fromStageId" TEXT,
    "fromStageName" TEXT,
    "fromOutcome" "DealOutcome",
    "fromPipelineId" TEXT,
    "fromPipelineName" TEXT,
    "toStageId" TEXT NOT NULL,
    "toStageName" TEXT NOT NULL,
    "toOutcome" "DealOutcome" NOT NULL,
    "toPipelineId" TEXT NOT NULL,
    "toPipelineName" TEXT NOT NULL,
    "reason" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dealStageChange_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "dealStageChange_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deal"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "dealStageChange_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "dealStageChange_dealId_occurredAt_idx" ON "dealStageChange"("dealId", "occurredAt");
