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
import logoImage from "@assets/ChatGPT Image Sep 12, 2025, 02_08_13 AM_1757623256298.png";

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
        <header className="border-b border-border glass-card header-gradient shadow-lg sticky top-0 z-50" data-testid="header">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-20 items-center justify-between">
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-3 float-animation">
                  <div className="h-12 w-12 rounded-xl overflow-hidden shadow-lg">
                    <img 
                      src={logoImage}
                      alt="Xenova Pay Logo"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const nextEl = e.currentTarget.nextElementSibling as HTMLElement;
                        if (nextEl) nextEl.style.display = 'flex';
                      }}
                    />
                    <div 
                      className="w-full h-full bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center"
                      style={{ display: 'none' }}
                    >
                      <DollarSignIcon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 bg-clip-text text-transparent">
                      Xenova Pay
                    </h1>
                    <p className="text-xs text-muted-foreground -mt-1">
                      Mobile Money Payments
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-3 px-4 py-2 rounded-full bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-700">
                  <div className="h-3 w-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 shadow-lg animate-pulse"></div>
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">🇷🇼 Rwanda</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  data-testid="button-theme-toggle"
                  className="relative h-10 w-10 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/20 transition-all duration-300"
                >
                  <SunIcon className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-purple-600" />
                  <MoonIcon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-purple-400" />
                  <span className="sr-only">Toggle theme</span>
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">

          {/* Payment Result Display */}
          {paymentResult && (
            <Card className="mb-8 border-0 glass-card shadow-xl scale-in" data-testid="payment-result">
              <CardContent className="p-8">
                <div className="flex items-center space-x-6">
                  <div className={`p-3 rounded-full ${paymentResult.success ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'}`}>
                    {paymentResult.success ? (
                      <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
                    ) : (
                      <XCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-foreground mb-2">
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
            <Tabs value={currentTab} onValueChange={setCurrentTab} data-testid="payment-tabs" className="slide-up">
              <TabsList className="grid w-full grid-cols-3 glass-card p-2 h-14">
                <TabsTrigger value="receive" data-testid="tab-receive" className="tab-trigger data-[state=active]:gradient-button rounded-lg h-10 font-medium">
                  <ArrowDownIcon className="mr-2 h-4 w-4" />
                  Receive Payments
                </TabsTrigger>
                <TabsTrigger value="payouts" data-testid="tab-payouts" className="tab-trigger data-[state=active]:gradient-button rounded-lg h-10 font-medium">
                  <ArrowUpIcon className="mr-2 h-4 w-4" />
                  Send Payouts
                </TabsTrigger>
                <TabsTrigger value="transactions" data-testid="tab-transactions" className="tab-trigger data-[state=active]:gradient-button rounded-lg h-10 font-medium">
                  <ListIcon className="mr-2 h-4 w-4" />
                  Transaction History
                </TabsTrigger>
              </TabsList>

              <div className="mt-8">
                <TabsContent value="receive" data-testid="receive-content" className="scale-in">
                  <DepositForm country={RWANDA} />
                </TabsContent>

                <TabsContent value="payouts" data-testid="payouts-content" className="scale-in">
                  <PayoutForm country={RWANDA} providers={Array.isArray(providers) ? providers : []} />
                </TabsContent>

                <TabsContent value="transactions" data-testid="transactions-content" className="scale-in">
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
