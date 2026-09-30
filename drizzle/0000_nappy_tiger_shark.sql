CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_categories_name` ON `categories` (`name`);--> statement-breakpoint
CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`resource` text NOT NULL,
	`member` text NOT NULL,
	`body` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`resource`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_comments_resource_created` ON `comments` (`resource`,`created`);--> statement-breakpoint
CREATE TABLE `favorites` (
	`member` text NOT NULL,
	`resource` text NOT NULL,
	PRIMARY KEY(`member`, `resource`),
	FOREIGN KEY (`member`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`resource`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`joined` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `readings` (
	`member` text NOT NULL,
	`resource` text NOT NULL,
	`status` text NOT NULL,
	PRIMARY KEY(`member`, `resource`),
	FOREIGN KEY (`member`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`resource`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `resources` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`url` text,
	`type` text NOT NULL,
	`category` text,
	`tags` text NOT NULL,
	`author` text NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL,
	`file_key` text,
	`file_name` text,
	`file_size` integer,
	`file_type` text,
	FOREIGN KEY (`category`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_resources_category_created` ON `resources` (`category`,`created`);--> statement-breakpoint
CREATE INDEX `idx_resources_type_created` ON `resources` (`type`,`created`);--> statement-breakpoint
CREATE INDEX `idx_resources_author` ON `resources` (`author`);