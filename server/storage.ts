import { db } from "./db";
import { eq } from "drizzle-orm";
import { 
  users, items, transactions, tickets, redeemCodes, purchases, itemContents,
  type User, type Item, type Transaction, type Ticket, type InsertUser, type InsertItem, type InsertTransaction, type InsertTicket 
} from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserCredits(id: number, credits: number): Promise<User>;
  getUserCount(): Promise<number>;
  
  getItems(): Promise<Item[]>;
  getItem(id: number): Promise<Item | undefined>;
  createItem(item: InsertItem & { contents?: string[] }): Promise<Item>;
  
  getTransactions(): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransactionStatus(id: number, status: string): Promise<Transaction>;
  
  getTickets(): Promise<Ticket[]>;
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  updateTicketReply(id: number, reply: string): Promise<Ticket>;
  
  createPurchase(userId: number, itemId: number, content: string): Promise<void>;
  
  getRedeemCode(code: string): Promise<{ id: number; value: number; isUsed: boolean | null } | undefined>;
  markRedeemCodeUsed(id: number, userId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getUserCount(): Promise<number> {
    const result = await db.select().from(users);
    return result.length;
  }

  async updateUserCredits(id: number, credits: number): Promise<User> {
    const [user] = await db.update(users)
      .set({ credits })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getItems(): Promise<Item[]> {
    return await db.select().from(items);
  }

  async getItem(id: number): Promise<Item | undefined> {
    const [item] = await db.select().from(items).where(eq(items.id, id));
    return item;
  }

  async createItem(insertItem: InsertItem & { contents?: string[] }): Promise<Item> {
    const [item] = await db.insert(items).values(insertItem).returning();
    
    if (insertItem.type === 'sequential' && insertItem.contents) {
      await db.insert(itemContents).values(
        insertItem.contents.map((content, index) => ({
          itemId: item.id,
          pageNumber: index + 1,
          content,
        }))
      );
    }
    
    return item;
  }

  async getTransactions(): Promise<Transaction[]> {
    return await db.select().from(transactions);
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [tx] = await db.insert(transactions).values(transaction).returning();
    return tx;
  }

  async updateTransactionStatus(id: number, status: string): Promise<Transaction> {
    const [tx] = await db.update(transactions)
      .set({ status })
      .where(eq(transactions.id, id))
      .returning();
    return tx;
  }

  async getTickets(): Promise<Ticket[]> {
    return await db.select().from(tickets);
  }

  async createTicket(ticket: InsertTicket): Promise<Ticket> {
    const [t] = await db.insert(tickets).values(ticket).returning();
    return t;
  }

  async updateTicketReply(id: number, reply: string): Promise<Ticket> {
    const [t] = await db.update(tickets)
      .set({ reply, status: 'closed' })
      .where(eq(tickets.id, id))
      .returning();
    return t;
  }

  async createPurchase(userId: number, itemId: number, content: string): Promise<void> {
    await db.insert(purchases).values({
      userId,
      itemId,
      contentDelivered: content,
    });
  }

  async getRedeemCode(code: string) {
    const [rc] = await db.select().from(redeemCodes).where(eq(redeemCodes.code, code));
    return rc;
  }

  async markRedeemCodeUsed(id: number, userId: number): Promise<void> {
    await db.update(redeemCodes)
      .set({ isUsed: true, usedBy: userId })
      .where(eq(redeemCodes.id, id));
  }
}

export const storage = new DatabaseStorage();
