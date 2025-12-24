import { pgTable, text, serial, integer, boolean, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"), // 'admin' or 'user'
  credits: integer("credits").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(),
  type: text("type").notNull(), // 'full' or 'sequential'
  content: text("content"), // For 'full' type items
  createdAt: timestamp("created_at").defaultNow(),
});

export const itemContents = pgTable("item_contents", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull(),
  pageNumber: integer("page_number").notNull(),
  content: text("content").notNull(),
});

export const purchases = pgTable("purchases", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  itemId: integer("item_id").notNull(),
  purchasedAt: timestamp("purchased_at").defaultNow(),
  contentDelivered: text("content_delivered"),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  transactionId: text("transaction_id").notNull(), // User provided ID
  amount: integer("amount").notNull(), // Credits
  status: text("status").notNull().default("pending"), // 'pending', 'approved', 'rejected'
  createdAt: timestamp("created_at").defaultNow(),
});

export const redeemCodes = pgTable("redeem_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  value: integer("value").notNull(),
  isUsed: boolean("is_used").default(false),
  usedBy: integer("used_by"), // Nullable
  createdAt: timestamp("created_at").defaultNow(),
});

export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("open"), // 'open', 'closed'
  reply: text("reply"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const itemsRelations = relations(items, ({ many }) => ({
  contents: many(itemContents),
}));

export const itemContentsRelations = relations(itemContents, ({ one }) => ({
  item: one(items, {
    fields: [itemContents.itemId],
    references: [items.id],
  }),
}));

// Schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, credits: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export const insertItemSchema = createInsertSchema(items).omit({ id: true, createdAt: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, userId: true, status: true, createdAt: true });
export const insertTicketSchema = createInsertSchema(tickets).omit({ id: true, userId: true, status: true, reply: true, createdAt: true });

export type User = typeof users.$inferSelect;
export type Item = typeof items.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Ticket = typeof tickets.$inferSelect;
