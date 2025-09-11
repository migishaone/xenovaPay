import { apiRequest } from "./queryClient";

export interface CountryConfig {
  country: string;
  prefix: string;
  flag: string;
  displayName: {
    en: string;
    fr?: string;
  };
  providers: Provider[];
}

export interface Provider {
  provider: string;
  displayName: string;
  logo?: string;
  currencies: Currency[];
}

export interface Currency {
  currency: string;
  displayName: string;
  operationTypes: {
    DEPOSIT?: OperationType;
    PAYOUT?: OperationType;
  };
}

export interface OperationType {
  minAmount: string;
  maxAmount: string;
  decimalsInAmount: 'NONE' | 'TWO_PLACES';
  authType?: string;
  pinPrompt?: string;
  pinPromptRevivable?: boolean;
}

export interface PredictProviderResponse {
  country: string;
  provider: string;
  phoneNumber: string;
}

export interface TransactionResponse {
  transactionId: string;
  status: string;
  created?: string;
  amount?: string;
  currency?: string;
  country?: string;
  providerTransactionId?: string;
  error?: string;
}

export const pawaPayService = {
  async getActiveConfig(country: string, operationType?: 'DEPOSIT' | 'PAYOUT'): Promise<{ countries: CountryConfig[] }> {
    const url = `/api/active-config/${country}${operationType ? `?operationType=${operationType}` : ''}`;
    const response = await apiRequest('GET', url);
    return response.json();
  },

  async predictProvider(phoneNumber: string): Promise<PredictProviderResponse> {
    const response = await apiRequest('POST', '/api/predict-provider', { phoneNumber });
    return response.json();
  },

  async initiateDeposit(data: {
    phoneNumber: string;
    provider: string;
    amount: string;
    currency: string;
    description?: string;
  }): Promise<TransactionResponse> {
    const response = await apiRequest('POST', '/api/deposits', data);
    return response.json();
  },

  async initiatePayout(data: {
    phoneNumber: string;
    provider: string;
    amount: string;
    currency: string;
    description?: string;
  }): Promise<TransactionResponse> {
    const response = await apiRequest('POST', '/api/payouts', data);
    return response.json();
  },

  async checkDepositStatus(id: string): Promise<TransactionResponse> {
    const response = await apiRequest('GET', `/api/deposits/${id}/status`);
    return response.json();
  },

  async checkPayoutStatus(id: string): Promise<TransactionResponse> {
    const response = await apiRequest('GET', `/api/payouts/${id}/status`);
    return response.json();
  },

  async getTransactions(): Promise<any[]> {
    const response = await apiRequest('GET', '/api/transactions');
    return response.json();
  },

  async getProviders(country: string): Promise<Provider[]> {
    const response = await apiRequest('GET', `/api/providers/${country}`);
    return response.json();
  },

  async initiateHostedPayment(data: {
    phoneNumber: string;
    amount: string;
    currency: string;
    description?: string;
    country: string;
  }): Promise<{ transactionId: string; redirectUrl: string }> {
    const response = await apiRequest('POST', '/api/hosted-payment', data);
    return response.json();
  },
};
