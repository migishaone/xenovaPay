import { type Transaction, type InsertTransaction, type Provider, type InsertProvider } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Transaction operations
  getTransaction(id: string): Promise<Transaction | undefined>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction | undefined>;
  getAllTransactions(): Promise<Transaction[]>;
  getTransactionsByType(type: string): Promise<Transaction[]>;

  // Provider operations  
  getProvider(code: string): Promise<Provider | undefined>;
  getProvidersByCountry(country: string): Promise<Provider[]>;
  createProvider(provider: InsertProvider): Promise<Provider>;
  getAllProviders(): Promise<Provider[]>;
}

export class MemStorage implements IStorage {
  private transactions: Map<string, Transaction>;
  private providers: Map<string, Provider>;

  constructor() {
    this.transactions = new Map();
    this.providers = new Map();
    
    // Initialize with some default providers
    this.initializeProviders();
  }

  private async initializeProviders() {
    const defaultProviders: InsertProvider[] = [
      // Rwanda
      { code: 'MTN_MOMO_RWA', displayName: 'MTN Rwanda', country: 'RWA', currency: 'RWF', isActive: true },
      { code: 'AIRTEL_RWA', displayName: 'Airtel Rwanda', country: 'RWA', currency: 'RWF', isActive: true },
      
      // Uganda  
      { code: 'MTN_MOMO_UGA', displayName: 'MTN Uganda', country: 'UGA', currency: 'UGX', isActive: true },
      { code: 'AIRTEL_UGA', displayName: 'Airtel Uganda', country: 'UGA', currency: 'UGX', isActive: true },
      
      // Kenya
      { code: 'MPESA', displayName: 'M-Pesa', country: 'KEN', currency: 'KES', isActive: true },
      { code: 'AIRTEL_KEN', displayName: 'Airtel Kenya', country: 'KEN', currency: 'KES', isActive: true },
    ];

    for (const provider of defaultProviders) {
      await this.createProvider(provider);
    }
  }

  async getTransaction(id: string): Promise<Transaction | undefined> {
    return this.transactions.get(id);
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const now = new Date();
    const transaction: Transaction = {
      ...insertTransaction,
      description: insertTransaction.description || null,
      created: now,
      updated: now,
    };
    this.transactions.set(transaction.id, transaction);
    return transaction;
  }

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction | undefined> {
    const existing = this.transactions.get(id);
    if (!existing) return undefined;

    const updated: Transaction = {
      ...existing,
      ...updates,
      updated: new Date(),
    };
    this.transactions.set(id, updated);
    return updated;
  }

  async getAllTransactions(): Promise<Transaction[]> {
    return Array.from(this.transactions.values()).sort((a, b) => b.created.getTime() - a.created.getTime());
  }

  async getTransactionsByType(type: string): Promise<Transaction[]> {
    return Array.from(this.transactions.values())
      .filter(t => t.type === type)
      .sort((a, b) => b.created.getTime() - a.created.getTime());
  }

  async getProvider(code: string): Promise<Provider | undefined> {
    return this.providers.get(code);
  }

  async getProvidersByCountry(country: string): Promise<Provider[]> {
    return Array.from(this.providers.values())
      .filter(p => p.country === country && p.isActive);
  }

  async createProvider(insertProvider: InsertProvider): Promise<Provider> {
    const id = randomUUID();
    const provider: Provider = { 
      ...insertProvider, 
      id,
      logo: insertProvider.logo || null 
    };
    this.providers.set(provider.code, provider);
    return provider;
  }

  async getAllProviders(): Promise<Provider[]> {
    return Array.from(this.providers.values()).filter(p => p.isActive);
  }
}

export const storage = new MemStorage();
