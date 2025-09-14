import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Download, Share2, Home, Calendar, Phone, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TransactionData {
  id: string;
  type: string;
  status: string;
  amount: string;
  currency: string;
  country: string;
  phoneNumber: string;
  provider: string;
  created: string;
  updated: string;
}

export default function Receipt() {
  const [, setLocation] = useLocation();
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [autoPrinted, setAutoPrinted] = useState(false);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    
    if (id) {
      setTransactionId(id);
    } else {
      setLocation('/');
    }
    
    // Send completion message to parent window if opened in popup
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage({
          type: 'PAYMENT_COMPLETE',
          status: 'COMPLETED',
          transactionId: id
        }, window.location.origin);
        
        // Close popup after a delay to show success animation
        setTimeout(() => {
          window.close();
        }, 3000);
      } catch (error) {
        console.log('Failed to notify parent window:', error);
      }
    }
  }, [setLocation]);

  const { data: receiptData, isLoading, error } = useQuery<TransactionData>({
    queryKey: ['/api/transactions', transactionId],
    enabled: !!transactionId,
  });

  // Live status polling to reflect backend confirmation without user interaction
  useEffect(() => {
    if (!transactionId) return;
    let timer: number | undefined;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/payment-status/${transactionId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const status = String(data.status || '').toUpperCase();
        if (status) setLiveStatus(status);
        if (status === 'COMPLETED' || status === 'FAILED') return; // stop polling
      } catch {}
      timer = window.setTimeout(poll, 2000);
    };

    poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [transactionId]);

  // Automatically trigger browser print dialog once when payment is confirmed
  useEffect(() => {
    const status = (liveStatus || receiptData?.status || '').toUpperCase();
    if (!autoPrinted && status === 'COMPLETED') {
      setAutoPrinted(true);
      setTimeout(() => window.print(), 300);
    }
  }, [receiptData, liveStatus, autoPrinted]);

  const effectiveStatus = (liveStatus || receiptData?.status || 'PENDING').toUpperCase();

  const handleDownload = () => {
    window.print();
  };

  const handleShare = async () => {
    if (navigator.share && receiptData) {
      await navigator.share({
        title: 'Payment Receipt - Xenova Pay',
        text: `Payment of ${receiptData.amount} ${receiptData.currency} completed successfully. Transaction ID: ${receiptData.id}`,
      });
    }
  };

  if (isLoading || !receiptData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading receipt...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">Failed to load receipt</p>
          <Button onClick={() => setLocation('/')}>Back to Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Success Header */}
        <div className="text-center mb-8 scale-in">
          {effectiveStatus === 'COMPLETED' ? (
            <>
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/20 dark:to-emerald-900/20 mb-6 float-animation">
                <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 bg-clip-text text-transparent mb-2">
                Payment Successful!
              </h1>
              <p className="text-muted-foreground text-lg">Your payment has been processed successfully</p>
            </>
          ) : (
            <>
              <div className="animate-spin h-10 w-10 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-6"></div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Processing Payment…</h1>
              <p className="text-muted-foreground text-lg">Just a moment while we confirm your payment</p>
            </>
          )}
        </div>

        {/* Receipt Card */}
        <Card className="glass-card border-0 shadow-2xl mb-8 slide-up">
          <CardContent className="p-8">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500"></div>
            
            {/* Header */}
            <div className="text-center mb-8 pt-4">
              <h2 className="text-2xl font-bold text-foreground mb-2">Payment Receipt</h2>
              <div className="flex items-center justify-center space-x-2">
                <Badge variant="outline" className="status-success text-white border-0">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {effectiveStatus}
                </Badge>
              </div>
            </div>

            {/* Transaction Details */}
            <div className="space-y-6">
              {/* Amount */}
              <div className="text-center py-6 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/10 dark:to-indigo-900/10 rounded-2xl">
                <p className="text-sm text-muted-foreground mb-2">Amount Paid</p>
                <p className="text-5xl font-bold bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 bg-clip-text text-transparent">
                  {receiptData.amount || '---'} <span className="text-2xl">{receiptData.currency || 'RWF'}</span>
                </p>
              </div>

              {/* Transaction Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Transaction ID</p>
                      <p className="font-mono text-sm font-medium">{receiptData.id}</p>
                    </div>
                  </div>

                  {receiptData.phoneNumber && (
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                        <Phone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Phone Number</p>
                        <p className="font-medium">{receiptData.phoneNumber}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/20 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Date & Time</p>
                      <p className="font-medium">
                        {receiptData.created 
                          ? new Date(receiptData.created).toLocaleString()
                          : new Date().toLocaleString()
                        }
                      </p>
                    </div>
                  </div>

                  {receiptData.provider && (
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">MTN</span>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Payment Method</p>
                        <p className="font-medium">MTN Mobile Money</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 pt-6 border-t border-border">
              <Button 
                onClick={handleDownload}
                variant="outline"
                className="h-12 rounded-xl font-medium hover:bg-purple-50 hover:border-purple-200 dark:hover:bg-purple-900/20"
              >
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
              
              <Button 
                onClick={handleShare}
                variant="outline"
                className="h-12 rounded-xl font-medium hover:bg-blue-50 hover:border-blue-200 dark:hover:bg-blue-900/20"
              >
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
              
              <Button 
                onClick={() => setLocation('/')}
                className="gradient-button h-12 rounded-xl font-medium"
              >
                <Home className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>Thank you for using Xenova Pay</p>
          <p>Keep this receipt for your records</p>
        </div>
      </div>
    </div>
  );
}
