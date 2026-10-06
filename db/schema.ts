// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
export const members = sqliteTable("members", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  joined: text("joined").notNull(),
});
export const securityLimits = sqliteTable("security_limits", {
  member: text("member").notNull(),
  purpose: text("purpose").notNull(),
  window: integer("window").notNull(),
  used: integer("used").notNull(),
}, t => [primaryKey({ columns: [t.member, t.purpose] })]);
export const communityMedia = sqliteTable("community_media", {
  id: text("id").primaryKey(),
  owner: text("owner")
    .notNull()
    .references(() => members.id),
  kind: text("kind").notNull(),
  objectKey: text("object_key").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  created: text("created").notNull(),
});
export const profiles = sqliteTable("profiles", {
  member: text("member")
    .primaryKey()
    .references(() => members.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  bio: text("bio").notNull(),
  avatar: text("avatar").references(() => communityMedia.id, {
    onDelete: "set null",
  }),
  updated: text("updated").notNull(),
});
export const posts = sqliteTable(
  "posts",
  {
    id: text("id").primaryKey(),
    author: text("author")
      .notNull()
      .references(() => members.id),
    body: text("body").notNull(),
    image: text("image").references(() => communityMedia.id, {
      onDelete: "set null",
    }),
    imageAlt: text("image_alt").notNull(),
    created: text("created").notNull(),
    updated: text("updated").notNull(),
  },
  (t) => [
    index("idx_posts_created").on(t.created, t.id),
    index("idx_posts_author_created").on(t.author, t.created),
    uniqueIndex("idx_posts_image").on(t.image),
  ],
);
export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    color: text("color").notNull(),
  },
  (t) => [uniqueIndex("idx_categories_name").on(t.name)],
);
export const resources = sqliteTable(
  "resources",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    url: text("url"),
    type: text("type").notNull(),
    category: text("category").references(() => categories.id),
    tags: text("tags").notNull(),
    author: text("author")
      .notNull()
      .references(() => members.id),
    created: text("created").notNull(),
    updated: text("updated").notNull(),
    fileKey: text("file_key"),
    fileName: text("file_name"),
    fileSize: integer("file_size"),
    fileType: text("file_type"),
  },
  (t) => [
    index("idx_resources_category_created").on(t.category, t.created),
    index("idx_resources_type_created").on(t.type, t.created),
    index("idx_resources_author").on(t.author),
  ],
);
export const favorites = sqliteTable(
  "favorites",
  {
    member: text("member")
      .notNull()
      .references(() => members.id),
    resource: text("resource")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.member, t.resource] })],
);
export const readings = sqliteTable(
  "readings",
  {
    member: text("member")
      .notNull()
      .references(() => members.id),
    resource: text("resource")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
  },
  (t) => [primaryKey({ columns: [t.member, t.resource] })],
);
export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    resource: text("resource")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    member: text("member")
      .notNull()
      .references(() => members.id),
    body: text("body").notNull(),
    created: text("created").notNull(),
  },
  (t) => [index("idx_comments_resource_created").on(t.resource, t.created)],
);
export const projectIdeas = sqliteTable(
  "project_ideas",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    inspiration: text("inspiration").notNull(),
    links: text("links").notNull(),
    tags: text("tags").notNull(),
    nextSteps: text("next_steps").notNull(),
    status: text("status").notNull(),
    sourceResource: text("source_resource").references(() => resources.id, {
      onDelete: "set null",
    }),
    author: text("author")
      .notNull()
      .references(() => members.id),
    created: text("created").notNull(),
    updated: text("updated").notNull(),
  },
  (t) => [index("idx_project_ideas_status_updated").on(t.status, t.updated)],
);
