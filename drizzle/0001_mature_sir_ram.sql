CREATE TABLE `teacher_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_salt` text NOT NULL,
	`password_digest` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teacher_credentials_username_unique` ON `teacher_credentials` (`username`);