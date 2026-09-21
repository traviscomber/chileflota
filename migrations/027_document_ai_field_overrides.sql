-- AI Human Override Lineage
-- PROPOSAL ONLY: this migration is committed for review and must not be applied
-- to production without explicit owner authorization and release validation.
--
-- Purpose: preserve field-level AI -> human corrections so extraction quality can
-- later be evaluated from reviewed truth. This table is audit/evaluation evidence,
-- not product telemetry and not a replacement for canonical document state.

CREATE TABLE IF NOT EXISTS public.document_ai_field_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL,
  document_source TEXT NOT NULL CHECK (
    document_source IN ('subcontractor_documents', 'uploaded_documents')
  ),
  field_name TEXT NOT NULL CHECK (
    field_name IN ('document_type', 'expiration_date', 'issuance_date', 'document_number')
  ),
  ai_value TEXT,
  human_value TEXT,
  ai_analyzed_at TIMESTAMPTZ NOT NULL,
  ai_confidence NUMERIC CHECK (
    ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 1)
  ),
  model_name TEXT,
  prompt_revision TEXT,
  reviewer_id TEXT NOT NULL,
  reviewer_role TEXT,
  reviewed_at TIMESTAMPTZ NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT document_ai_field_overrides_changed_value
    CHECK (ai_value IS DISTINCT FROM human_value)
);

CREATE INDEX IF NOT EXISTS idx_document_ai_field_overrides_document
  ON public.document_ai_field_overrides(document_source, document_id, ai_analyzed_at DESC);

CREATE INDEX IF NOT EXISTS idx_document_ai_field_overrides_field
  ON public.document_ai_field_overrides(field_name, reviewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_document_ai_field_overrides_reviewer
  ON public.document_ai_field_overrides(reviewer_id, reviewed_at DESC);

ALTER TABLE public.document_ai_field_overrides ENABLE ROW LEVEL SECURITY;

-- Deliberately expose no direct anon/authenticated policies in v1.
-- Future writes must come through an authenticated, assignment-aware server boundary.
REVOKE ALL ON public.document_ai_field_overrides FROM anon;
REVOKE ALL ON public.document_ai_field_overrides FROM authenticated;

COMMENT ON TABLE public.document_ai_field_overrides IS
  'Field-level AI-to-human correction evidence for extraction evaluation. Separate from operational telemetry and canonical document state.';

COMMENT ON COLUMN public.document_ai_field_overrides.ai_analyzed_at IS
  'Timestamp of the exact AI prediction event being corrected; required to avoid conflating later re-analysis with older evidence.';

COMMENT ON COLUMN public.document_ai_field_overrides.ai_confidence IS
  'Model-reported confidence at extraction time. This value is not observed accuracy.';

COMMENT ON COLUMN public.document_ai_field_overrides.idempotency_key IS
  'Deterministic SHA-256 evidence key generated from document, field, prediction event, values, model/prompt and reviewer.';
