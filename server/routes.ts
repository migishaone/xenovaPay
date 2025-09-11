import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { randomUUID } from "crypto";
import { 
  depositRequestSchema, 
  payoutRequestSchema, 
  predictProviderRequestSchema,
  type DepositRequest,
  type PayoutRequest,
  type PredictProviderRequest 
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  const API_BASE = process.env.PAWAPAY_API_BASE || "https://api.sandbox.pawapay.io/v2";
  const WIDGET_API_BASE = "https://api.sandbox.pawapay.cloud/v1";
  const API_TOKEN = process.env.PAWAPAY_API_TOKEN || "your-api-token";

  // Helper function to make PawaPay API calls
  async function callPawaPayAPI(endpoint: string, method: string = 'GET', data?: any, useWidgetAPI: boolean = false) {
    const baseUrl = useWidgetAPI ? WIDGET_API_BASE : API_BASE;
    const url = `${baseUrl}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      const responseData = await response.json();
      
      if (!response.ok) {
        throw new Error(`PawaPay API Error: ${response.status} - ${JSON.stringify(responseData)}`);
      }
      
      return responseData;
    } catch (error) {
      console.error('PawaPay API call failed:', error);
      throw error;
    }
  }

  // Get active configuration for a country
  app.get('/api/active-config/:country', async (req, res) => {
    try {
      const { country } = req.params;
      const { operationType } = req.query;
      
      let endpoint = `/active-conf?country=${country}`;
      if (operationType) {
        endpoint += `&operationType=${operationType}`;
      }
      
      const config = await callPawaPayAPI(endpoint);
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Predict provider for phone number
  app.post('/api/predict-provider', async (req, res) => {
    try {
      const validatedData = predictProviderRequestSchema.parse(req.body);
      
      const prediction = await callPawaPayAPI('/predict-provider', 'POST', {
        phoneNumber: validatedData.phoneNumber
      });
      
      res.json(prediction);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Initiate deposit
  app.post('/api/deposits', async (req, res) => {
    try {
      const validatedData = depositRequestSchema.parse(req.body);
      const depositId = randomUUID();

      // Create transaction record
      const transaction = await storage.createTransaction({
        id: depositId,
        type: 'DEPOSIT',
        status: 'PENDING',
        amount: validatedData.amount,
        currency: validatedData.currency,
        country: '', // Will be updated from PawaPay response
        phoneNumber: validatedData.phoneNumber,
        provider: validatedData.provider,
        description: validatedData.description,
        pawapayResponse: null,
        providerTransactionId: null,
        errorMessage: null,
      });

      try {
        // Call PawaPay API
        const pawaPayRequest = {
          depositId,
          amount: validatedData.amount,
          currency: validatedData.currency,
          payer: {
            type: 'MMO',
            accountDetails: {
              phoneNumber: validatedData.phoneNumber,
              provider: validatedData.provider
            }
          }
        };

        const pawaPayResponse = await callPawaPayAPI('/deposits', 'POST', pawaPayRequest);
        
        // Update transaction with response
        await storage.updateTransaction(depositId, {
          status: pawaPayResponse.status,
          pawapayResponse: JSON.stringify(pawaPayResponse),
          country: pawaPayResponse.country || ''
        });

        res.json({
          transactionId: depositId,
          ...pawaPayResponse
        });

      } catch (apiError) {
        // Update transaction with error
        const errorMsg = apiError instanceof Error ? apiError.message : 'Unknown API error';
        await storage.updateTransaction(depositId, {
          status: 'FAILED',
          errorMessage: errorMsg
        });

        res.status(500).json({
          transactionId: depositId,
          error: errorMsg
        });
      }
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Initiate payout
  app.post('/api/payouts', async (req, res) => {
    try {
      const validatedData = payoutRequestSchema.parse(req.body);
      const payoutId = randomUUID();

      // Create transaction record
      const transaction = await storage.createTransaction({
        id: payoutId,
        type: 'PAYOUT',
        status: 'PENDING',
        amount: validatedData.amount,
        currency: validatedData.currency,
        country: '', // Will be updated from PawaPay response
        phoneNumber: validatedData.phoneNumber,
        provider: validatedData.provider,
        description: validatedData.description,
        pawapayResponse: null,
        providerTransactionId: null,
        errorMessage: null,
      });

      try {
        // Call PawaPay API
        const pawaPayRequest = {
          payoutId,
          amount: validatedData.amount,
          currency: validatedData.currency,
          recipient: {
            type: 'MMO',
            accountDetails: {
              phoneNumber: validatedData.phoneNumber,
              provider: validatedData.provider
            }
          }
        };

        console.log('PawaPay payout request:', JSON.stringify(pawaPayRequest, null, 2));
        const pawaPayResponse = await callPawaPayAPI('/payouts', 'POST', pawaPayRequest);
        
        // Update transaction with response
        await storage.updateTransaction(payoutId, {
          status: pawaPayResponse.status,
          pawapayResponse: JSON.stringify(pawaPayResponse),
          country: pawaPayResponse.country || ''
        });

        res.json({
          transactionId: payoutId,
          ...pawaPayResponse
        });

      } catch (apiError) {
        // Update transaction with error
        await storage.updateTransaction(payoutId, {
          status: 'FAILED',
          errorMessage: apiError.message
        });

        res.status(500).json({
          transactionId: payoutId,
          error: apiError.message
        });
      }
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Check deposit status
  app.get('/api/deposits/:id/status', async (req, res) => {
    try {
      const { id } = req.params;
      const transaction = await storage.getTransaction(id);
      
      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      try {
        const pawaPayResponse = await callPawaPayAPI(`/deposits/${id}/status`);
        
        // Update transaction if status changed
        if (pawaPayResponse.status !== transaction.status) {
          await storage.updateTransaction(id, {
            status: pawaPayResponse.status,
            pawapayResponse: JSON.stringify(pawaPayResponse),
            providerTransactionId: pawaPayResponse.providerTransactionId
          });
        }

        res.json(pawaPayResponse);
      } catch (apiError) {
        res.json({
          transactionId: id,
          status: transaction.status,
          error: apiError.message
        });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Check payout status
  app.get('/api/payouts/:id/status', async (req, res) => {
    try {
      const { id } = req.params;
      const transaction = await storage.getTransaction(id);
      
      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      try {
        const pawaPayResponse = await callPawaPayAPI(`/payouts/${id}/status`);
        
        // Update transaction if status changed
        if (pawaPayResponse.status !== transaction.status) {
          await storage.updateTransaction(id, {
            status: pawaPayResponse.status,
            pawapayResponse: JSON.stringify(pawaPayResponse),
            providerTransactionId: pawaPayResponse.providerTransactionId
          });
        }

        res.json(pawaPayResponse);
      } catch (apiError) {
        res.json({
          transactionId: id,
          status: transaction.status,
          error: apiError.message
        });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get all transactions
  app.get('/api/transactions', async (req, res) => {
    try {
      const transactions = await storage.getAllTransactions();
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get transaction by ID
  app.get('/api/transactions/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const transaction = await storage.getTransaction(id);
      
      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      res.json(transaction);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get providers by country
  app.get('/api/providers/:country', async (req, res) => {
    try {
      const { country } = req.params;
      const providers = await storage.getProvidersByCountry(country);
      res.json(providers);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create hosted payment page session
  app.post('/api/hosted-payment', async (req, res) => {
    try {
      const { phoneNumber, amount, currency, description, country } = req.body;
      const depositId = randomUUID();
      const returnUrl = `${req.protocol}://${req.get('host')}/payment-return?depositId=${depositId}`;

      // Create transaction record
      const transaction = await storage.createTransaction({
        id: depositId,
        type: 'DEPOSIT',
        status: 'PENDING',
        amount: amount,
        currency: currency,
        country: country,
        phoneNumber: phoneNumber,
        provider: '', // Will be selected on hosted page
        description: description,
        pawapayResponse: null,
        providerTransactionId: null,
        errorMessage: null,
      });

      try {
        // Create widget session
        const sessionRequest = {
          depositId,
          returnUrl,
          statementDescription: description || 'Payment',
          amount: amount,
          msisdn: phoneNumber,
          language: 'EN',
          country: country,
          reason: description || 'Payment'
        };

        console.log('Creating widget session:', JSON.stringify(sessionRequest, null, 2));
        const sessionResponse = await callPawaPayAPI('/widget/sessions', 'POST', sessionRequest, true);
        
        // Update transaction with session info
        await storage.updateTransaction(depositId, {
          pawapayResponse: JSON.stringify(sessionResponse)
        });

        res.json({
          transactionId: depositId,
          redirectUrl: sessionResponse.redirectUrl
        });

      } catch (apiError) {
        // Update transaction with error
        const errorMsg = apiError instanceof Error ? apiError.message : 'Unknown API error';
        await storage.updateTransaction(depositId, {
          status: 'FAILED',
          errorMessage: errorMsg
        });

        res.status(500).json({
          transactionId: depositId,
          error: errorMsg
        });
      }
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Payment return handler
  app.get('/payment-return', async (req, res) => {
    try {
      const { depositId } = req.query;
      
      if (!depositId || typeof depositId !== 'string') {
        return res.status(400).send('Missing or invalid depositId');
      }

      // Check payment status
      const transaction = await storage.getTransaction(depositId);
      if (!transaction) {
        return res.status(404).send('Transaction not found');
      }

      // Get the latest status from PawaPay
      try {
        const statusResponse = await callPawaPayAPI(`/deposits/${depositId}/status`);
        
        await storage.updateTransaction(depositId, {
          status: statusResponse.status,
          pawapayResponse: JSON.stringify(statusResponse),
          providerTransactionId: statusResponse.providerTransactionId,
          country: statusResponse.country || transaction.country
        });

        // Redirect to frontend with results
        const frontendUrl = `/?paymentResult=${encodeURIComponent(JSON.stringify({
          transactionId: depositId,
          status: statusResponse.status,
          success: statusResponse.status === 'COMPLETED'
        }))}`;
        
        res.redirect(frontendUrl);
      } catch (apiError) {
        // Still redirect to frontend but with error status
        const frontendUrl = `/?paymentResult=${encodeURIComponent(JSON.stringify({
          transactionId: depositId,
          status: 'FAILED',
          success: false,
          error: apiError instanceof Error ? apiError.message : 'Status check failed'
        }))}`;
        
        res.redirect(frontendUrl);
      }
    } catch (error) {
      res.status(500).send('Payment return processing failed');
    }
  });

  // PawaPay callback webhook endpoint
  app.post('/api/callback', async (req, res) => {
    try {
      const callbackData = req.body;
      
      // Extract transaction ID from callback
      const transactionId = callbackData.depositId || callbackData.payoutId;
      
      if (!transactionId) {
        return res.status(400).json({ error: 'No transaction ID in callback' });
      }

      // Update transaction status
      await storage.updateTransaction(transactionId, {
        status: callbackData.status,
        pawapayResponse: JSON.stringify(callbackData),
        providerTransactionId: callbackData.providerTransactionId,
        country: callbackData.country || ''
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Callback processing error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
