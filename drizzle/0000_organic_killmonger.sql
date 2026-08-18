CREATE TABLE `answers` (
	`attempt_id` text NOT NULL,
	`question_id` text NOT NULL,
	`selected_index` integer NOT NULL,
	`confidence` text NOT NULL,
	`used_hint` integer NOT NULL,
	`correct` integer NOT NULL,
	PRIMARY KEY(`attempt_id`, `question_id`),
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`version_id` text NOT NULL,
	`island` text NOT NULL,
	`score` integer NOT NULL,
	`correct_count` integer NOT NULL,
	`sure_count` integer NOT NULL,
	`hint_count` integer NOT NULL,
	`completed_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`version_id`) REFERENCES `question_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `classes` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `classes_code_unique` ON `classes` (`code`);--> statement-breakpoint
CREATE TABLE `progress` (
	`student_id` text NOT NULL,
	`island` text NOT NULL,
	`best_score` integer DEFAULT 0 NOT NULL,
	`trophy` integer DEFAULT 0 NOT NULL,
	`no_hint_best` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`student_id`, `island`),
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `question_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`version_number` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`published_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `question_versions_number_unique` ON `question_versions` (`version_number`);--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`version_id` text NOT NULL,
	`question_id` text NOT NULL,
	`island` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`stem` text NOT NULL,
	`passage` text,
	`option_a` text NOT NULL,
	`option_b` text NOT NULL,
	`option_c` text NOT NULL,
	`option_d` text NOT NULL,
	`correct_index` integer NOT NULL,
	`explanation` text NOT NULL,
	`hint` text NOT NULL,
	`source` text,
	`work_tag` text,
	FOREIGN KEY (`version_id`) REFERENCES `question_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `questions_version_question_unique` ON `questions` (`version_id`,`question_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_digest` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`subject_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` text PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`seat` text NOT NULL,
	`student_no` text,
	`name` text NOT NULL,
	`nickname` text,
	`pin_digest` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`last_login_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `students_class_seat_unique` ON `students` (`class_id`,`seat`);