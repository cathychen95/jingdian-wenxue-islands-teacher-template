DELETE FROM `sessions`
WHERE `role` = 'student'
  AND rowid NOT IN (
    SELECT MAX(rowid)
    FROM `sessions`
    WHERE `role` = 'student'
    GROUP BY `subject_id`
  );
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_student_subject_unique` ON `sessions` (`subject_id`) WHERE "sessions"."role" = 'student';
--> statement-breakpoint
PRAGMA optimize;
