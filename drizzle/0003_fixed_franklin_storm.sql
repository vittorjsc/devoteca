CREATE TABLE `security_limits` (
	`member` text NOT NULL,
	`purpose` text NOT NULL,
	`window` integer NOT NULL,
	`used` integer NOT NULL,
	PRIMARY KEY(`member`, `purpose`)
);
