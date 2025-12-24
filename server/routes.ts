import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { api } from "@shared/routes";
import { z } from "zod";

async function seedDatabase() {
  const existingItems = await storage.getItems();
  if (existingItems.length === 0) {
    await storage.createItem({
      title: "Neon Sword",
      description: "A glowing plasma blade.",
      price: 500,
      type: "full",
      content: "You have unlocked the Neon Sword asset pack!"
    });
    await storage.createItem({
      title: "Hacker Manifesto",
      description: "The 3-part guide to the grid.",
      price: 1000,
      type: "sequential",
      contents: [
        "Chapter 1: The Signal",
        "Chapter 2: The Noise",
        "Chapter 3: The Silence"
      ]
    });
    // Create an admin user for testing (password: admin123)
    // We can't easily hash password here without helper, but register route handles it.
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);
  await seedDatabase();

  app.get(api.items.list.path, async (req, res) => {
    const items = await storage.getItems();
    res.json(items);
  });

  app.get(api.items.get.path, async (req, res) => {
    const item = await storage.getItem(Number(req.params.id));
    if (!item) return res.status(404).json({ message: "Item not found" });
    res.json(item);
  });

  app.post(api.items.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    if (req.user.role !== "admin") return res.status(403).json({ message: "Admin only" });
    const item = await storage.createItem(req.body);
    res.status(201).json(item);
  });

  app.post(api.items.purchase.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const user = await storage.getUser(req.user.id);
    const item = await storage.getItem(Number(req.params.id));
    
    if (!user || !item) return res.status(404).json({ message: "Not found" });
    if (user.credits < item.price) return res.status(400).json({ message: "Insufficient credits" });

    let content = item.content || "Purchased!";
    
    // Logic for sequential items could go here to fetch next available page
    
    await storage.updateUserCredits(user.id, user.credits - item.price);
    await storage.createPurchase(user.id, item.id, content);
    
    res.json({ message: "Purchase successful", content });
  });

  app.get(api.transactions.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    if (req.user.role !== "admin") return res.status(403).json({ message: "Admin only" });
    const txs = await storage.getTransactions();
    res.json(txs);
  });

  app.post(api.transactions.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const tx = await storage.createTransaction({ ...req.body, userId: req.user.id });
    res.status(201).json(tx);
  });

  app.post(api.transactions.approve.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    if (req.user.role !== "admin") return res.status(403).json({ message: "Admin only" });
    const tx = await storage.updateTransactionStatus(Number(req.params.id), "approved");
    // Add credits to user
    const user = await storage.getUser(tx.userId);
    if (user) {
      await storage.updateUserCredits(user.id, user.credits + tx.amount);
    }
    res.json(tx);
  });

  app.post(api.transactions.reject.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    if (req.user.role !== "admin") return res.status(403).json({ message: "Admin only" });
    const tx = await storage.updateTransactionStatus(Number(req.params.id), "rejected");
    res.json(tx);
  });

  app.get(api.tickets.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const tickets = await storage.getTickets();
    if (req.user.role !== "admin") {
      res.json(tickets.filter(t => t.userId === req.user.id));
    } else {
      res.json(tickets);
    }
  });

  app.post(api.tickets.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const ticket = await storage.createTicket({ ...req.body, userId: req.user.id });
    res.status(201).json(ticket);
  });

  app.post(api.tickets.reply.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    if (req.user.role !== "admin") return res.status(403).json({ message: "Admin only" });
    const ticket = await storage.updateTicketReply(Number(req.params.id), req.body.reply);
    res.json(ticket);
  });

  app.post(api.codes.redeem.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const code = await storage.getRedeemCode(req.body.code);
    
    if (!code || code.isUsed) return res.status(400).json({ message: "Invalid or used code" });
    
    await storage.markRedeemCodeUsed(code.id, req.user.id);
    const user = await storage.getUser(req.user.id);
    if (user) {
      await storage.updateUserCredits(user.id, user.credits + code.value);
    }
    
    res.json({ message: "Code redeemed", value: code.value });
  });

  return httpServer;
}
