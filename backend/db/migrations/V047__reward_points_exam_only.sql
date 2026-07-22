-- Reward points are earned only from the four required exams in each course.
-- Remove points previously awarded by quizzes while preserving non-negative balances.
WITH quiz_points AS (
    SELECT student_id, COALESCE(SUM(awarded_points), 0)::INTEGER AS points
    FROM student_reward_sources
    WHERE assessment_type = 'QUIZ'
    GROUP BY student_id
)
UPDATE student_reward_balances AS balance
SET available_points = GREATEST(0, balance.available_points - quiz_points.points),
    lifetime_points = GREATEST(0, balance.lifetime_points - quiz_points.points),
    updated_at = NOW()
FROM quiz_points
WHERE balance.student_id = quiz_points.student_id;

DELETE FROM student_reward_sources
WHERE assessment_type = 'QUIZ';

ALTER TABLE student_reward_sources
DROP CONSTRAINT IF EXISTS student_reward_sources_assessment_type_check;

ALTER TABLE student_reward_sources
ADD CONSTRAINT student_reward_sources_assessment_type_check
CHECK (assessment_type = 'EXAM');
