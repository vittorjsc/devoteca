CREATE TABLE `community_media` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`kind` text NOT NULL,
	`object_key` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`owner`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`author` text NOT NULL,
	`body` text NOT NULL,
	`image` text,
	`image_alt` text NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL,
	FOREIGN KEY (`author`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`image`) REFERENCES `community_media`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_posts_created` ON `posts` (`created`,`id`);--> statement-breakpoint
CREATE INDEX `idx_posts_author_created` ON `posts` (`author`,`created`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_posts_image` ON `posts` (`image`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`member` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`bio` text NOT NULL,
	`avatar` text,
	`updated` text NOT NULL,
	FOREIGN KEY (`member`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`avatar`) REFERENCES `community_media`(`id`) ON UPDATE no action ON DELETE set null
);
