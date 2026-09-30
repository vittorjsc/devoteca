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
