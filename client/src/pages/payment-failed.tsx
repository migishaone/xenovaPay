import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle, RefreshCw, Home, AlertTriangle, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface FailedPaymentData {
  transactionId: string;
  error?: string;
  status: string;
  amount?: string;
  currency?: string;
  phoneNumber?: string;
}

export default function PaymentFailed() {
  const [, setLocation] = useLocation();
  const [failedData, setFailedData] = useState<FailedPaymentData | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const data = urlParams.get('data');
    
    if (data) {
      try {
        const parsed = JSON.parse(decodeURIComponent(data));
        setFailedData(parsed);
      } catch (error) {
        console.error('Error parsing failed payment data:', error);
        setLocation('/');
      }
    } else {
      setLocation('/');
    }
  }, [setLocation]);

  const handleTryAgain = () => {
    setLocation('/');
  };

  const handleContactSupport = () => {
    // In a real app, this would open support chat or email
    alert('For support, please contact: support@xenova.com or call +250-XXX-XXXX');
  };

  if (!failedData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-red-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Failed Header */}
        <div className="text-center mb-8 scale-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-r from-red-100 to-rose-100 dark:from-red-900/20 dark:to-rose-900/20 mb-6">
            <XCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 via-rose-600 to-pink-600 bg-clip-text text-transparent mb-2">
            Payment Failed
          </h1>
          <p className="text-muted-foreground text-lg">
            We couldn't process your payment at this time
          </p>
        </div>

        {/* Failed Payment Card */}
        <Card className="glass-card border-0 shadow-2xl mb-8 slide-up">
          <CardContent className="p-8">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-500 via-rose-500 to-pink-500"></div>
            
            {/* Header */}
            <div className="text-center mb-8 pt-4">
              <h2 className="text-2xl font-bold text-foreground mb-2">Payment Details</h2>
              <div className="flex items-center justify-center space-x-2">
                <Badge variant="destructive" className="status-failed text-white border-0">
                  <XCircle className="h-3 w-3 mr-1" />
                  {failedData.status}
                </Badge>
              </div>
            </div>

            {/* Error Message */}
            {failedData.error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-red-800 dark:text-red-300 mb-1">Error Details</p>
                    <p className="text-sm text-red-700 dark:text-red-400">{failedData.error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Transaction Details */}
            <div className="space-y-6">
              {/* Amount */}
              {failedData.amount && (
                <div className="text-center py-6 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-900/10 dark:to-slate-900/10 rounded-2xl border border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-muted-foreground mb-2">Attempted Amount</p>
                  <p className="text-4xl font-bold text-gray-600 dark:text-gray-400">
                    {failedData.amount} <span className="text-2xl">{failedData.currency || 'RWF'}</span>
                  </p>
                </div>
              )}

              {/* Transaction Info */}
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                    <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Transaction ID</p>
                    <p className="font-mono text-sm font-medium">{failedData.transactionId}</p>
                  </div>
                </div>

                {failedData.phoneNumber && (
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                      <Phone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Phone Number</p>
                      <p className="font-medium">{failedData.phoneNumber}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Common Issues */}
            <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl">
              <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-3">Common Issues & Solutions</h3>
              <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-2">
                <li>• Check if you have sufficient balance in your mobile money account</li>
                <li>• Verify your phone number is correct and active</li>
                <li>• Try again in a few minutes - sometimes there are temporary network issues</li>
                <li>• Make sure your mobile money account is not suspended</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 pt-6 border-t border-border">
              <Button 
                onClick={handleTryAgain}
                className="gradient-button h-12 rounded-xl font-medium"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
              
              <Button 
                onClick={handleContactSupport}
                variant="outline"
                className="h-12 rounded-xl font-medium hover:bg-blue-50 hover:border-blue-200 dark:hover:bg-blue-900/20"
              >
                <Phone className="mr-2 h-4 w-4" />
                Contact Support
              </Button>
              
              <Button 
                onClick={() => setLocation('/')}
                variant="outline"
                className="h-12 rounded-xl font-medium hover:bg-gray-50 hover:border-gray-200 dark:hover:bg-gray-900/20"
              >
                <Home className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>Need help? Contact our support team</p>
          <p>We're here to help you complete your payment</p>
        </div>
      </div>
    </div>
  );
}