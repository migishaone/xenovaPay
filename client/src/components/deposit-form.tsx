import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { pawaPayService } from "@/lib/pawapay";
import { NotebookPen, ExternalLink, CreditCard } from "lucide-react";

const depositSchema = z.object({
  phoneNumber: z.string().min(9, "Phone number must be at least 9 digits"),
  provider: z.string().optional(),
  amount: z.string().min(1, "Amount is required").refine(val => !isNaN(Number(val)) && Number(val) >= 5, "Amount must be at least 5 RWF"),
  description: z.string()
    .min(4, "Description must be at least 4 characters")
    .max(22, "Description must be 22 characters or less")
    .regex(/^[a-zA-Z0-9 ]*$/, "Description can only contain letters, numbers and spaces")
    .optional(),
});

type DepositForm = z.infer<typeof depositSchema>;

interface DepositFormProps {
  country?: {
    code: string;
    name: string;
    currency: string;
    prefix: string;
  };
}

export function DepositForm({ country }: DepositFormProps) {
  const [transactionId, setTransactionId] = useState<string>('');
  const [status, setStatus] = useState<string>('Ready');
  const [isPaymentInProgress, setIsPaymentInProgress] = useState(false);
  const [paymentPopup, setPaymentPopup] = useState<Window | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<DepositForm>({
    resolver: zodResolver(depositSchema),
  });

  const phoneNumber = watch("phoneNumber");
  const description = watch("description");


  const depositMutation = useMutation({
    mutationFn: async (data: DepositForm) => {
      if (!country) throw new Error("Country not available");
      
      const fullPhoneNumber = country.prefix + data.phoneNumber.replace(/\D/g, '');
      
      return pawaPayService.initiateHostedPayment({
        phoneNumber: fullPhoneNumber,
        amount: data.amount,
        currency: country.currency,
        description: data.description,
        country: country.code,
      });
    },
    onSuccess: (data) => {
      setTransactionId(data.transactionId);
      setStatus('PAYMENT_INITIATED');
      
      toast({
        title: "Opening Payment Window",
        description: `Transaction ID: ${data.transactionId}`,
      });
      
      // Redirect popup to payment URL (popup was opened synchronously on form submit)
      if (paymentPopup && !paymentPopup.closed) {
        paymentPopup.location.href = data.redirectUrl;
        monitorPaymentPopup(paymentPopup, data.transactionId);
      } else {
        // Fallback: open popup if it was closed or blocked
        openPaymentPopup(data.redirectUrl, data.transactionId);
      }
    },
    onError: (error) => {
      setStatus('FAILED');
      setIsPaymentInProgress(false);
      
      // Close popup if it was opened but API failed
      if (paymentPopup && !paymentPopup.closed) {
        paymentPopup.close();
        setPaymentPopup(null);
      }
      
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Popup monitoring logic
  const openPaymentPopup = (url: string, txId: string) => {
    const popup = window.open(
      url,
      'pawapay-payment',
      'width=450,height=700,scrollbars=yes,resizable=yes,status=yes,location=yes,toolbar=no,menubar=no'
    );
    
    if (!popup) {
      toast({
        title: "Popup Blocked",
        description: "Please allow popups for this site to complete payment",
        variant: "destructive",
      });
      setIsPaymentInProgress(false);
      setStatus('Ready');
      return;
    }
    
    setPaymentPopup(popup);
    
    // Monitor popup for messages and closure
    monitorPaymentPopup(popup, txId);
  };
  
  const monitorPaymentPopup = (popup: Window, txId: string) => {
    let pollInterval: NodeJS.Timeout;
    let isComplete = false;
    
    // Listen for postMessage from popup
    const messageListener = (event: MessageEvent) => {
      // Verify origin for security
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'PAYMENT_COMPLETE' && event.data.transactionId === txId) {
        handlePaymentComplete(event.data.status, event.data.transactionId);
        isComplete = true;
        popup.close();
      } else if (event.data.type === 'PAYMENT_FAILED' && event.data.transactionId === txId) {
        handlePaymentFailed(event.data.error || 'Payment failed', event.data.transactionId);
        isComplete = true;
        popup.close();
      }
    };
    
    window.addEventListener('message', messageListener);
    
    // Polling fallback in case postMessage doesn't work
    pollInterval = setInterval(async () => {
      try {
        if (popup.closed) {
          if (!isComplete) {
            // Popup closed without completion - check status via API
            await checkTransactionStatus(txId);
          }
          cleanup();
          return;
        }
        
        // Poll transaction status
        await checkTransactionStatus(txId);
      } catch (error) {
        // Popup is from different origin, can't access - continue polling
      }
    }, 3000);
    
    const cleanup = () => {
      window.removeEventListener('message', messageListener);
      if (pollInterval) clearInterval(pollInterval);
      setPaymentPopup(null);
    };
    
    // Auto-cleanup after 15 minutes
    setTimeout(() => {
      if (!isComplete && popup && !popup.closed) {
        popup.close();
        handlePaymentTimeout();
      }
      cleanup();
    }, 15 * 60 * 1000);
  };
  
  const checkTransactionStatus = async (txId: string) => {
    try {
      const response = await fetch(`/api/payment-status/${txId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'COMPLETED') {
          handlePaymentComplete(data.status, txId);
          // Close popup when polling detects completion
          if (paymentPopup && !paymentPopup.closed) {
            paymentPopup.close();
          }
        } else if (data.status === 'FAILED') {
          handlePaymentFailed('Payment failed', txId);
          // Close popup when polling detects failure
          if (paymentPopup && !paymentPopup.closed) {
            paymentPopup.close();
          }
        }
      }
    } catch (error) {
      console.log('Status check failed:', error);
    }
  };
  
  const handlePaymentComplete = (status: string, txId: string) => {
    setStatus('COMPLETED');
    setIsPaymentInProgress(false);
    
    toast({
      title: "Payment Successful!",
      description: `Your payment has been completed successfully.`,
    });
    
    // Refresh transaction history
    queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
  };
  
  const handlePaymentFailed = (error: string, txId: string) => {
    setStatus('FAILED');
    setIsPaymentInProgress(false);
    
    toast({
      title: "Payment Failed",
      description: error,
      variant: "destructive",
    });
  };
  
  const handlePaymentTimeout = () => {
    setStatus('TIMEOUT');
    setIsPaymentInProgress(false);
    
    toast({
      title: "Payment Timeout",
      description: "Payment window was closed. Please try again if payment was not completed.",
      variant: "destructive",
    });
  };

  const onSubmit = (data: DepositForm) => {
    if (!country || isPaymentInProgress) return;
    
    // Open popup synchronously on user click to avoid popup blockers
    const popup = window.open(
      'about:blank',
      'pawapay-payment',
      'width=450,height=700,scrollbars=yes,resizable=yes,status=yes,location=yes,toolbar=no,menubar=no'
    );
    
    if (!popup) {
      toast({
        title: "Popup Blocked",
        description: "Please allow popups for this site to complete payment",
        variant: "destructive",
      });
      return;
    }
    
    // Set loading content in popup
    popup.document.write(`
      <html>
        <head><title>Loading Payment...</title></head>
        <body style="font-family: system-ui; text-align: center; padding: 50px; background: #f9fafb;">
          <div style="max-width: 300px; margin: 0 auto;">
            <div style="border: 4px solid #e5e7eb; border-top: 4px solid #3b82f6; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
            <h2 style="color: #374151; margin-bottom: 10px;">Loading Payment...</h2>
            <p style="color: #6b7280; font-size: 14px;">Please wait while we prepare your payment.</p>
          </div>
          <style>
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          </style>
        </body>
      </html>
    `);
    
    setPaymentPopup(popup);
    setIsPaymentInProgress(true);
    
    // Now make the API call
    depositMutation.mutate(data);
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'COMPLETED': return 'bg-green-100 text-green-800 border-green-300';
      case 'PAYMENT_INITIATED':
      case 'PENDING': 
      case 'ACCEPTED': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'FAILED': 
      case 'TIMEOUT': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };
  
  const getStatusDisplayText = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PAYMENT_INITIATED': return 'Payment Window Opened';
      case 'COMPLETED': return 'Payment Successful';
      case 'FAILED': return 'Payment Failed';
      case 'TIMEOUT': return 'Payment Timed Out';
      default: return status;
    }
  };

  return (
    <div className="max-w-lg mx-auto slide-up">
      <Card data-testid="payment-form" className="glass-card border-0 shadow-2xl overflow-hidden">
        <CardContent className="p-8 relative">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-600"></div>
          <div className="text-center mb-8">
            <h3 className="text-3xl font-bold bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 bg-clip-text text-transparent mb-2">
              Receive Payment
            </h3>
            <p className="text-muted-foreground text-sm">
              Safe & secure mobile money payments
            </p>
          </div>
          

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <Label htmlFor="deposit-phone">Phone Number</Label>
              <div className="flex">
                <span className="inline-flex items-center px-3 text-sm text-muted-foreground bg-muted border border-r-0 border-border rounded-l-md">
                  +{country?.prefix || '250'}
                </span>
                <Input
                  id="deposit-phone"
                  data-testid="input-deposit-phone"
                  {...register("phoneNumber")}
                  className="flex-1 rounded-l-none"
                  placeholder="783456789"
                  disabled={!country}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Enter phone number without country code
              </p>
              {errors.phoneNumber && (
                <p className="mt-1 text-xs text-destructive">{errors.phoneNumber.message}</p>
              )}
            </div>


            <div>
              <Label htmlFor="deposit-amount">Amount</Label>
              <div className="relative">
                <Input
                  id="deposit-amount"
                  data-testid="input-deposit-amount"
                  {...register("amount")}
                  type="number"
                  className="pr-12"
                  placeholder="100"
                  min="1"
                  disabled={!country}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-sm text-muted-foreground">
                    {country?.currency || 'RWF'}
                  </span>
                </div>
              </div>
              {errors.amount && (
                <p className="mt-1 text-xs text-destructive">{errors.amount.message}</p>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center">
                <Label htmlFor="deposit-description">Description (Optional)</Label>
                <span className="text-xs text-muted-foreground">
                  {description ? description.length : 0}/22
                </span>
              </div>
              <Input
                id="deposit-description"
                data-testid="input-deposit-description"
                {...register("description")}
                placeholder="Payment for services"
                maxLength={22}
                disabled={!country}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Min 4 chars. Only letters, numbers and spaces allowed
              </p>
              {errors.description && (
                <p className="mt-1 text-xs text-destructive">{errors.description.message}</p>
              )}
            </div>

            <Button 
              type="submit" 
              data-testid="button-pay-now"
              className="w-full gradient-button h-14 text-lg font-semibold rounded-xl shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300" 
              disabled={!country || isPaymentInProgress || depositMutation.isPending}
            >
              <CreditCard className="mr-3 h-5 w-5" />
              <span>
                {isPaymentInProgress 
                  ? "Payment in Progress..." 
                  : depositMutation.isPending 
                  ? "Opening Payment..." 
                  : "Pay Now"
                }
              </span>
            </Button>
          </form>
        </CardContent>
      </Card>
      
      {/* Payment Status */}
      {status !== 'Ready' && (
        <Card className="mt-6" data-testid="payment-status">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Payment Status</span>
              <span 
                data-testid="payment-status-badge"
                className={`px-3 py-1 text-sm font-medium rounded-full border ${getStatusColor(status)}`}
              >
                {getStatusDisplayText(status)}
              </span>
            </div>
            {transactionId && (
              <div className="text-sm text-muted-foreground mt-2">
                <span>Transaction ID: </span>
                <code 
                  data-testid="payment-transaction-id"
                  className="text-xs bg-background px-2 py-1 rounded"
                >
                  {transactionId}
                </code>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
