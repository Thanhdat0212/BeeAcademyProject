-- Fix schema drift bang exam_attempts.
--
-- DB dang giu lai cac cot NOT NULL tu mot phien ban exam_attempts CU
-- (exam_id, status, deadline_at, draft_version, integrity_violation_count).
-- Entity ExamAttempt hien tai KHONG map cac cot nay (dung exam_config_id,
-- score_percent, passed, ...). Vi vay moi INSERT khi hoc sinh nop bai kiem tra
-- bi Postgres chan o "null value in column exam_id ... violates not-null
-- constraint" -> 500, va bang exam_attempts luon rong.
--
-- Fix: bo rang buoc NOT NULL tren cac cot legacy khong con duoc code su dung.
-- Khong xoa cot (giu du lieu, tranh dung view/policy neu co) va khong doi entity.
-- Idempotent + portable: chi dong vao cot neu that su ton tai, nen DB sach tao
-- tu V009 (khong co cac cot nay) chay migration nay van an toan.

DO $$
DECLARE
    legacy_col TEXT;
BEGIN
    FOREACH legacy_col IN ARRAY ARRAY[
        'exam_id',
        'status',
        'deadline_at',
        'draft_version',
        'integrity_violation_count'
    ]
    LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'exam_attempts'
              AND column_name = legacy_col
        ) THEN
            EXECUTE format(
                'ALTER TABLE public.exam_attempts ALTER COLUMN %I DROP NOT NULL',
                legacy_col
            );
        END IF;
    END LOOP;
END $$;
