ALTER TABLE public.parent_link_audit_log
    ADD COLUMN IF NOT EXISTS operation_id UUID,
    ADD COLUMN IF NOT EXISTS reason VARCHAR(500);

CREATE UNIQUE INDEX IF NOT EXISTS uq_parent_link_audit_log_operation
    ON public.parent_link_audit_log (operation_id)
    WHERE operation_id IS NOT NULL;
