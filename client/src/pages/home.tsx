import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { CountrySelector } from "@/components/country-selector";
import { DepositForm } from "@/components/deposit-form";
import { PayoutForm } from "@/components/payout-form";
import { TransactionHistory } from "@/components/transaction-history";
import { ThemeProvider } from "next-themes";
import { Button } from "@/components/ui/button";
import { MoonIcon, SunIcon, DollarSignIcon } from "lucide-react";

interface Country {
  code: string;
  name: string;
  currency: string;
  prefix: string;
}

export default function Home() {
  const [selectedCountry, setSelectedCountry] = useState<Country>();
  const [currentTab, setCurrentTab] = useState<string>('deposits');

  const { data: providers = [] } = useQuery({
    queryKey: ['/api/providers', selectedCountry?.code],
    enabled: !!selectedCountry?.code,
  });

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
                  <h1 className="text-xl font-bold text-foreground">Xenova Money</h1>
                </div>
                <span className="text-sm text-muted-foreground border-l pl-4">
                  PawaPay Testing Interface
                </span>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  <span>Sandbox Mode</span>
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
          {/* Country Selection */}
          <div className="mb-8">
            <CountrySelector 
              onCountrySelect={setSelectedCountry}
              selectedCountry={selectedCountry}
            />
          </div>

          {/* Testing Interface Tabs */}
          <div className="mb-8">
            <Tabs value={currentTab} onValueChange={setCurrentTab} data-testid="testing-tabs">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="deposits" data-testid="tab-deposits">
                  <ArrowDownIcon className="mr-2 h-4 w-4" />
                  Deposits (Collect)
                </TabsTrigger>
                <TabsTrigger value="payouts" data-testid="tab-payouts">
                  <ArrowUpIcon className="mr-2 h-4 w-4" />
                  Payouts (Send)
                </TabsTrigger>
                <TabsTrigger value="transactions" data-testid="tab-transactions">
                  <ListIcon className="mr-2 h-4 w-4" />
                  History
                </TabsTrigger>
              </TabsList>

              <div className="mt-6">
                <TabsContent value="deposits" data-testid="deposits-content">
                  <DepositForm country={selectedCountry} providers={providers} />
                </TabsContent>

                <TabsContent value="payouts" data-testid="payouts-content">
                  <PayoutForm country={selectedCountry} providers={providers} />
                </TabsContent>

                <TabsContent value="transactions" data-testid="transactions-content">
                  <TransactionHistory />
                </TabsContent>
              </div>
            </Tabs>
          </div>

          {/* API Documentation Quick Reference */}
          <Card className="mt-12" data-testid="api-reference">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">API Quick Reference</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-foreground mb-2">Sandbox Endpoints</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs bg-muted px-2 py-1 rounded">POST</span>
                      <span className="text-muted-foreground">api.sandbox.pawapay.io/v2/deposits</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs bg-muted px-2 py-1 rounded">POST</span>
                      <span className="text-muted-foreground">api.sandbox.pawapay.io/v2/payouts</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs bg-muted px-2 py-1 rounded">GET</span>
                      <span className="text-muted-foreground">api.sandbox.pawapay.io/v2/active-conf</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-2">Test Phone Numbers</h4>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div>Rwanda: +250783456789</div>
                    <div>Uganda: +256701234567</div>
                    <div>Kenya: +254701234567</div>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border">
                <a 
                  href="https://docs.pawapay.io/v2/docs" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80 text-sm font-medium"
                  data-testid="link-documentation"
                >
                  <i className="fas fa-external-link-alt mr-1"></i>
                  View Full API Documentation
                </a>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </ThemeProvider>
  );
}

// Import missing icons
import { ArrowDownIcon, ArrowUpIcon, ListIcon } from "lucide-react";
