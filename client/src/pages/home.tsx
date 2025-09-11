import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { DepositForm } from "@/components/deposit-form";
import { PayoutForm } from "@/components/payout-form";
import { TransactionHistory } from "@/components/transaction-history";
import { ThemeProvider } from "next-themes";
import { Button } from "@/components/ui/button";
import { MoonIcon, SunIcon, DollarSignIcon, CheckCircle, XCircle, ArrowDownIcon, ArrowUpIcon, ListIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Country {
  code: string;
  name: string;
  currency: string;
  prefix: string;
  flag?: string;
}

const RWANDA: Country = {
  code: 'RWA',
  name: 'Rwanda',
  currency: 'RWF',
  prefix: '250',
  flag: '🇷🇼'
};

export default function Home() {
  const [currentTab, setCurrentTab] = useState<string>('receive');
  const [paymentResult, setPaymentResult] = useState<any>(null);
  const { toast } = useToast();

  const { data: providers = [] } = useQuery({
    queryKey: ['/api/providers', RWANDA.code],
  });

  // Handle payment return from hosted page
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentResultParam = urlParams.get('paymentResult');
    
    if (paymentResultParam) {
      try {
        const result = JSON.parse(decodeURIComponent(paymentResultParam));
        setPaymentResult(result);
        setCurrentTab('transactions'); // Switch to history tab
        
        // Show toast based on payment status
        if (result.success) {
          toast({
            title: "Payment Completed!",
            description: `Transaction ID: ${result.transactionId}`,
          });
        } else {
          toast({
            title: "Payment Failed",
            description: result.error || "Payment could not be completed",
            variant: "destructive",
          });
        }
        
        // Clear the URL parameter
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (error) {
        console.error('Error parsing payment result:', error);
      }
    }
  }, [toast]);

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border bg-card shadow-sm" data-testid="header">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                    <DollarSignIcon className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <h1 className="text-xl font-bold text-foreground">Xenova Pay</h1>
                </div>
                <span className="text-sm text-muted-foreground border-l pl-4">
                  Mobile Money Payments
                </span>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  <span>Rwanda</span>
                </div>
                <Button variant="ghost" size="icon" data-testid="button-theme-toggle">
                  <SunIcon className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <MoonIcon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  <span className="sr-only">Toggle theme</span>
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">

          {/* Payment Result Display */}
          {paymentResult && (
            <Card className="mb-6 border-2" data-testid="payment-result">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  {paymentResult.success ? (
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  ) : (
                    <XCircle className="h-8 w-8 text-red-600" />
                  )}
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">
                      {paymentResult.success ? 'Payment Successful!' : 'Payment Failed'}
                    </h3>
                    <p className="text-muted-foreground">
                      Transaction ID: {paymentResult.transactionId}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Status: {paymentResult.status}
                    </p>
                    {paymentResult.error && (
                      <p className="text-sm text-red-600 mt-1">{paymentResult.error}</p>
                    )}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setPaymentResult(null)}
                  >
                    Dismiss
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment Interface */}
          <div className="mb-8">
            <Tabs value={currentTab} onValueChange={setCurrentTab} data-testid="payment-tabs">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="receive" data-testid="tab-receive">
                  <ArrowDownIcon className="mr-2 h-4 w-4" />
                  Receive Payments
                </TabsTrigger>
                <TabsTrigger value="payouts" data-testid="tab-payouts">
                  <ArrowUpIcon className="mr-2 h-4 w-4" />
                  Send Payouts
                </TabsTrigger>
                <TabsTrigger value="transactions" data-testid="tab-transactions">
                  <ListIcon className="mr-2 h-4 w-4" />
                  Transaction History
                </TabsTrigger>
              </TabsList>

              <div className="mt-6">
                <TabsContent value="receive" data-testid="receive-content">
                  <DepositForm country={RWANDA} providers={Array.isArray(providers) ? providers : []} />
                </TabsContent>

                <TabsContent value="payouts" data-testid="payouts-content">
                  <PayoutForm country={RWANDA} providers={Array.isArray(providers) ? providers : []} />
                </TabsContent>

                <TabsContent value="transactions" data-testid="transactions-content">
                  <TransactionHistory />
                </TabsContent>
              </div>
            </Tabs>
          </div>

        </main>
      </div>
    </ThemeProvider>
  );
}
