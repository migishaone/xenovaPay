import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey(),
  type: text("type").notNull(), // 'DEPOSIT' | 'PAYOUT'
  status: text("status").notNull(), // 'PENDING' | 'COMPLETED' | 'FAILED' | 'ACCEPTED'
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull(),
  country: text("country").notNull(),
  phoneNumber: text("phone_number").notNull(),
  provider: text("provider").notNull(),
  description: text("description"),
  providerTransactionId: text("provider_transaction_id"),
  pawapayResponse: text("pawapay_response"),
  errorMessage: text("error_message"),
  created: timestamp("created").defaultNow().notNull(),
  updated: timestamp("updated").defaultNow().notNull(),
});

export const providers = pgTable("providers", {
  id: varchar("id").primaryKey(),
  code: text("code").notNull().unique(),
  displayName: text("display_name").notNull(),
  country: text("country").notNull(),
  currency: text("currency").notNull(),
  logo: text("logo"),
  isActive: boolean("is_active").default(true).notNull(),
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  created: true,
  updated: true,
});

export const insertProviderSchema = createInsertSchema(providers).omit({
  id: true,
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Provider = typeof providers.$inferSelect;
export type InsertProvider = z.infer<typeof insertProviderSchema>;

// Request/Response schemas for PawaPay integration
export const depositRequestSchema = z.object({
  phoneNumber: z.string().min(10),
  provider: z.string(),
  amount: z.string(),
  currency: z.string(),
  description: z.string()
    .min(4, "Description must be at least 4 characters")
    .max(22, "Description must be 22 characters or less")
    .regex(/^[a-zA-Z0-9 ]*$/, "Description can only contain letters, numbers and spaces")
    .optional(),
});

export const payoutRequestSchema = z.object({
  phoneNumber: z.string().min(10),
  provider: z.string(),
  amount: z.string(),
  currency: z.string(),
  description: z.string().optional(),
});

export const predictProviderRequestSchema = z.object({
  phoneNumber: z.string().min(10),
});

export const directPaymentRequestSchema = z.object({
  phoneNumber: z.string()
    .min(10, "Phone number must be at least 10 digits")
    .regex(/^(\+250|250)?[0-9]{9}$/, "Phone number must be a valid Rwanda number (format: +250XXXXXXXXX or 250XXXXXXXXX or XXXXXXXXX)"),
  amount: z.string()
    .refine((val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num >= 5;
    }, "Amount must be at least 5 RWF"),
  currency: z.literal("RWF", {
    errorMap: () => ({ message: "Currency must be RWF for Rwanda direct payments" })
  }),
  country: z.literal("RWA", {
    errorMap: () => ({ message: "Country must be RWA for Rwanda direct payments" })
  }),
  description: z.string()
    .min(4, "Description must be at least 4 characters")
    .max(22, "Description must be 22 characters or less")
    .regex(/^[a-zA-Z0-9 ]*$/, "Description can only contain letters, numbers and spaces")
    .optional(),
});

export type DepositRequest = z.infer<typeof depositRequestSchema>;
export type PayoutRequest = z.infer<typeof payoutRequestSchema>;
export type PredictProviderRequest = z.infer<typeof predictProviderRequestSchema>;
export type DirectPaymentRequest = z.infer<typeof directPaymentRequestSchema>;
