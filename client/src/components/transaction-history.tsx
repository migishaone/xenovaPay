import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDownIcon, ArrowUpIcon, RefreshCwIcon, ReceiptIcon } from "lucide-react";
import { pawaPayService } from "@/lib/pawapay";

export function TransactionHistory() {
  const { data: transactions = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/transactions'],
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  const formatAmount = (amount: string, currency: string) => {
    return `${Number(amount).toLocaleString()} ${currency}`;
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'COMPLETED': return 'bg-green-100 text-green-800 border-green-300';
      case 'PENDING':
      case 'ACCEPTED': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'FAILED': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getTransactionIcon = (type: string) => {
    return type === 'DEPOSIT' ? (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
        <ArrowDownIcon className="h-5 w-5 text-green-600" />
      </div>
    ) : (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
        <ArrowUpIcon className="h-5 w-5 text-blue-600" />
      </div>
    );
  };

  return (
    <Card data-testid="transaction-history">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Transaction History</h3>
          <Button 
            variant="ghost" 
            size="sm" 
            data-testid="button-refresh-transactions"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCwIcon className="mr-1 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>
      
      <CardContent className="p-6">
        <div className="space-y-4" data-testid="transactions-list">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="text-sm text-muted-foreground">Loading transactions...</div>
            </div>
          ) : Array.isArray(transactions) && transactions.length === 0 ? (
            <div className="text-center py-12" data-testid="transactions-empty">
              <ReceiptIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h4 className="text-lg font-medium text-foreground mb-2">No transactions yet</h4>
              <p className="text-muted-foreground">Start testing deposits to see them here</p>
            </div>
          ) : (
            (transactions as any[]).map((transaction: any) => (
              <div
                key={transaction.id}
                data-testid={`transaction-${transaction.id}`}
                className="flex items-center justify-between p-4 border border-border rounded-lg"
              >
                <div className="flex items-center space-x-4">
                  {getTransactionIcon(transaction.type)}
                  <div>
                    <p className="font-medium text-foreground" data-testid={`transaction-type-${transaction.id}`}>
                      {transaction.type === 'DEPOSIT' ? 'Deposit' : 'Transaction'}
                    </p>
                    <p className="text-sm text-muted-foreground" data-testid={`transaction-phone-${transaction.id}`}>
                      {transaction.phoneNumber}
                    </p>
                    {transaction.description && (
                      <p className="text-xs text-muted-foreground" data-testid={`transaction-description-${transaction.id}`}>
                        {transaction.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-foreground" data-testid={`transaction-amount-${transaction.id}`}>
                    {formatAmount(transaction.amount, transaction.currency)}
                  </p>
                  <span 
                    className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(transaction.status)}`}
                    data-testid={`transaction-status-${transaction.id}`}
                  >
                    {transaction.status}
                  </span>
                  {transaction.providerTransactionId && (
                    <p className="text-xs text-muted-foreground mt-1" data-testid={`transaction-provider-id-${transaction.id}`}>
                      {transaction.providerTransactionId.substring(0, 8)}...
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
