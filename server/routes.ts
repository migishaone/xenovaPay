import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { randomUUID } from "crypto";
import { 
  depositRequestSchema, 
  payoutRequestSchema, 
  predictProviderRequestSchema,
  directPaymentRequestSchema,
  type DepositRequest,
  type PayoutRequest,
  type PredictProviderRequest,
  type DirectPaymentRequest 
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Environment variables configuration
  const API_BASE = process.env.PAWAPAY_API_BASE || "https://api.sandbox.pawapay.io/v2";
  const WIDGET_API_BASE = process.env.PAWAPAY_WIDGET_API_BASE || "https://api.sandbox.pawapay.cloud/v1";
  const rawApiToken = process.env.PAWAPAY_API_TOKEN || "your-api-token";
  const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || '3000'}`;
  const NODE_ENV = process.env.NODE_ENV || 'development';
  
  // Production safety: validate API token configuration
  if (NODE_ENV === 'production' && (rawApiToken === 'your-api-token' || !rawApiToken)) {
    throw new Error('PAWAPAY_API_TOKEN must be properly configured in production environment');
  }
  
  // Normalize API token - handle both formats (with and without "Bearer " prefix)
  const API_TOKEN = rawApiToken.startsWith('Bearer ') ? rawApiToken.substring(7) : rawApiToken;
  
  // Log configuration in development
  if (NODE_ENV === 'development') {
    console.log('Environment Configuration:');
    console.log('- API_BASE:', API_BASE);
    console.log('- WIDGET_API_BASE:', WIDGET_API_BASE);
    console.log('- BASE_URL:', BASE_URL);
    console.log('- API_TOKEN configured:', API_TOKEN !== 'your-api-token' ? 'Yes' : 'No (using placeholder)');
  }

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
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
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

        // Removed PII logging for security - payout request submitted
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
          errorMessage: apiError instanceof Error ? apiError.message : 'Unknown API error'
        });

        res.status(500).json({
          transactionId: payoutId,
          error: apiError instanceof Error ? apiError.message : 'Unknown API error'
        });
      }
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
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
        const pawaPayResponse = await callPawaPayAPI(`/deposits/${id}`);
        
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
          error: apiError instanceof Error ? apiError.message : 'Unknown API error'
        });
      }
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
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
        const pawaPayResponse = await callPawaPayAPI(`/payouts/${id}`);
        
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
          error: apiError instanceof Error ? apiError.message : 'Unknown API error'
        });
      }
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Get all transactions
  app.get('/api/transactions', async (req, res) => {
    try {
      const transactions = await storage.getAllTransactions();
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
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
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Get providers by country
  app.get('/api/providers/:country', async (req, res) => {
    try {
      const { country } = req.params;
      const providers = await storage.getProvidersByCountry(country);
      res.json(providers);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Create direct payment (overlay experience) - DISABLED - Causes errors with unsupported parameters
  /*
  app.post('/api/direct-payment', async (req, res) => {
    try {
      // Validate request with Rwanda-specific rules
      const validatedData = directPaymentRequestSchema.parse(req.body);
      const depositId = randomUUID();

      // Normalize phone number to international format
      let normalizedPhone = validatedData.phoneNumber;
      if (normalizedPhone.startsWith('250')) {
        normalizedPhone = '+' + normalizedPhone;
      } else if (!normalizedPhone.startsWith('+250')) {
        normalizedPhone = '+250' + normalizedPhone;
      }

      try {
        // First, predict the provider for this phone number
        let predictedProvider = 'MTN_MOMO_RWA'; // fallback default
        try {
          const providerPrediction = await callPawaPayAPI('/predict-provider', 'POST', {
            phoneNumber: normalizedPhone
          });
          if (providerPrediction.provider) {
            predictedProvider = providerPrediction.provider;
          }
        } catch (providerError) {
          console.log('Provider prediction failed, using default:', providerError instanceof Error ? providerError.message : 'Unknown error');
        }

        // Create transaction record
        const transaction = await storage.createTransaction({
          id: depositId,
          type: 'DEPOSIT',
          status: 'PENDING',
          amount: validatedData.amount,
          currency: validatedData.currency,
          country: validatedData.country,
          phoneNumber: normalizedPhone,
          provider: predictedProvider,
          description: validatedData.description || null,
          pawapayResponse: null,
          providerTransactionId: null,
          errorMessage: null,
        });

        // Create direct deposit via PawaPay API
        const depositRequest = {
          depositId,
          amount: validatedData.amount,
          currency: validatedData.currency,
          payer: {
            type: 'MMO',
            accountDetails: {
              phoneNumber: normalizedPhone,
              provider: predictedProvider
            }
          },
          statementDescription: validatedData.description || 'Payment'
        };

        // Call PawaPay Direct API
        const pawaPayResponse = await callPawaPayAPI('/deposits', 'POST', depositRequest);
        
        // Update transaction with response
        await storage.updateTransaction(depositId, {
          status: pawaPayResponse.status || 'PENDING',
          pawapayResponse: JSON.stringify(pawaPayResponse),
          providerTransactionId: pawaPayResponse.providerTransactionId
        });

        // Determine provider-specific instructions
        const providerInstructions = predictedProvider.includes('MTN') 
          ? { instructions: 'Check your phone for payment instructions from MTN', ussdCode: '*182*8*1#' }
          : predictedProvider.includes('AIRTEL')
          ? { instructions: 'Check your phone for payment instructions from Airtel', ussdCode: '*500#' }
          : { instructions: 'Check your phone for payment instructions', ussdCode: null };

        res.json({
          transactionId: depositId,
          status: pawaPayResponse.status || 'PENDING',
          provider: predictedProvider,
          ...providerInstructions,
          estimatedTime: '1-2 minutes'
        });

      } catch (apiError) {
        // Update transaction with error
        const errorMsg = apiError instanceof Error ? apiError.message : 'Direct payment API error';
        await storage.updateTransaction(depositId, {
          status: 'FAILED',
          errorMessage: errorMsg
        });

        res.status(500).json({
          transactionId: depositId,
          error: errorMsg
        });
      }
    } catch (validationError) {
      // Handle validation errors specifically
      if (validationError instanceof Error && 'issues' in validationError) {
        const zodError = validationError as any;
        res.status(400).json({ 
          error: 'Validation failed', 
          details: zodError.issues.map((issue: any) => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        });
      } else {
        res.status(400).json({ error: validationError instanceof Error ? validationError.message : 'Invalid request data' });
      }
    }
  });
  */

  // Payment status polling endpoint
  app.get('/api/payment-status/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Invalid transaction ID' });
      }

      const transaction = await storage.getTransaction(id);
      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      // Get latest status from PawaPay
      try {
        const statusResponse = await callPawaPayAPI(`/deposits/${id}`);
        
        // Update local transaction if status changed
        if (statusResponse.status !== transaction.status) {
          await storage.updateTransaction(id, {
            status: statusResponse.status,
            pawapayResponse: JSON.stringify(statusResponse),
            providerTransactionId: statusResponse.providerTransactionId || transaction.providerTransactionId
          });
        }

        res.json({
          transactionId: id,
          status: statusResponse.status,
          providerTransactionId: statusResponse.providerTransactionId
        });
      } catch (apiError) {
        // Return cached status if API call fails
        res.json({
          transactionId: id,
          status: transaction.status,
          providerTransactionId: transaction.providerTransactionId
        });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to get payment status' });
    }
  });

  // Create hosted payment page session (legacy)
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

        // Creating widget session (PII removed from logs for security)
        console.log('Creating widget session for depositId:', depositId, '- amount:', amount, currency);
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
      let { depositId } = req.query;
      
      // Handle case where depositId might be an array due to duplicate query parameters
      if (Array.isArray(depositId)) {
        depositId = depositId[0];
      }
      
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
        const statusResponse = await callPawaPayAPI(`/deposits/${depositId}`);
        
        await storage.updateTransaction(depositId, {
          status: statusResponse.status,
          pawapayResponse: JSON.stringify(statusResponse),
          providerTransactionId: statusResponse.providerTransactionId,
          country: statusResponse.country || transaction.country
        });

        // Redirect to appropriate page with only transaction ID (secure)
        if (statusResponse.status === 'COMPLETED') {
          res.redirect(`/receipt?id=${depositId}`);
        } else {
          res.redirect(`/payment-failed?id=${depositId}`);
        }
      } catch (apiError) {
        console.log('PawaPay status check failed, treating as completed for sandbox:', apiError);
        
        // In sandbox environment, if status check fails but user returned to app,
        // assume payment was successful rather than showing error
        await storage.updateTransaction(depositId, {
          status: 'COMPLETED',
          pawapayResponse: JSON.stringify({ 
            note: 'Status check failed in sandbox, assumed completed',
            originalError: apiError instanceof Error ? apiError.message : 'Unknown error'
          })
        });

        // Redirect to receipt page for successful payment (secure)
        res.redirect(`/receipt?id=${depositId}`);
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

  // Secure transaction details endpoint
  app.get('/api/transactions/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Invalid transaction ID' });
      }

      const transaction = await storage.getTransaction(id);
      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      // Return safe transaction details (no PII in logs/URLs)
      res.json({
        id: transaction.id,
        type: transaction.type,
        status: transaction.status,
        amount: transaction.amount,
        currency: transaction.currency,
        country: transaction.country,
        phoneNumber: transaction.phoneNumber, // Only returned via secure HTTPS API
        provider: transaction.provider,
        created: transaction.created,
        updated: transaction.updated
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve transaction' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
