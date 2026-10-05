CREATE TABLE `project_ideas` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`inspiration` text NOT NULL,
	`links` text NOT NULL,
	`tags` text NOT NULL,
	`next_steps` text NOT NULL,
	`status` text NOT NULL,
	`source_resource` text,
	`author` text NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL,
	FOREIGN KEY (`source_resource`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`author`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_project_ideas_status_updated` ON `project_ideas` (`status`,`updated`);