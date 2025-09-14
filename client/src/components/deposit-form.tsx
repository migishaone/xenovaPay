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
import { CreditCard } from "lucide-react";

const depositSchema = z.object({
  phoneNumber: z.string().min(9, "Phone number must be at least 9 digits"),
  provider: z.string().optional(),
  amount: z.string().min(1, "Amount is required").refine(val => !isNaN(Number(val)) && Number(val) >= 5, "Amount must be at least 5 RWF"),
  // Make description optional; if provided, validate, otherwise allow empty
  description: z.preprocess(
    (v) => {
      if (typeof v === 'string') {
        const t = v.trim();
        return t === '' ? undefined : t;
      }
      return v;
    },
    z.string()
      .min(4, "Description must be at least 4 characters")
      .max(22, "Description must be 22 characters or less")
      .regex(/^[a-zA-Z0-9 ]*$/, "Description can only contain letters, numbers and spaces")
      .optional()
  ),
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
  // Popup flow state
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
        description: (data.description && data.description.trim()) ? data.description.trim() : 'payment',
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
      // Navigate popup to the hosted payment URL and begin monitoring
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

  // Popup and monitoring logic — payment opens in popup and auto-closes, main tab redirects on completion
  const openPaymentPopup = (url: string, txId: string) => {
    const defaultWidth = 480;
    const defaultHeight = 720;
    const width = Math.min(defaultWidth, Math.max(360, window.outerWidth - 40));
    const height = Math.min(defaultHeight, Math.max(520, window.outerHeight - 80));
    const left = (window.screenX || 0) + Math.max(0, Math.round((window.outerWidth - width) / 2));
    const top = (window.screenY || 0) + Math.max(0, Math.round((window.outerHeight - height) / 2));

    const features = `width=${width},height=${height},left=${left},top=${top},` +
      `resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no,location=no`;

    const popup = window.open('about:blank', 'pawapay-payment', features);

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

    // Write lightweight loading UI (responsive)
    popup.document.write(`
      <html>
        <head>
          <title>Loading Payment...</title>
          <meta name=viewport content="width=device-width, initial-scale=1" />
          <style>
            body{font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f7f7fb}
            .wrap{max-width:320px;text-align:center}
            .spinner{border:4px solid #e5e7eb;border-top:4px solid #7c3aed;border-radius:50%;width:40px;height:40px;animation:spin 1s linear infinite;margin:0 auto 16px}
            h2{color:#111827;margin:0 0 6px}
            p{color:#6b7280;margin:0}
            @keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}
          </style>
        </head>
        <body>
          <div class="wrap">
            <div class="spinner"></div>
            <h2>Loading payment…</h2>
            <p>Please wait while we prepare your payment.</p>
          </div>
        </body>
      </html>
    `);

    setPaymentPopup(popup);
    monitorPaymentPopup(popup, txId);
    popup.location.replace(url);
  };

  const monitorPaymentPopup = (popup: Window, txId: string) => {
    let pollInterval: number | undefined;
    let completed = false;

    const redirectToReceipt = () => {
      window.location.assign(`/receipt?id=${txId}`);
    };
    const redirectToFailed = () => {
      window.location.assign(`/payment-failed?id=${txId}`);
    };

    const messageListener = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'PAYMENT_COMPLETE' && event.data?.transactionId === txId) {
        completed = true;
        try { popup.close(); } catch {}
        redirectToReceipt();
      } else if (event.data?.type === 'PAYMENT_FAILED' && event.data?.transactionId === txId) {
        completed = true;
        try { popup.close(); } catch {}
        redirectToFailed();
      }
    };
    window.addEventListener('message', messageListener);

    const poll = async () => {
      try {
        if (popup.closed) {
          if (!completed) {
            // Final status check on close
            const resp = await fetch(`/api/payment-status/${txId}`);
            if (resp.ok) {
              const data = await resp.json();
              if (String(data.status).toUpperCase() === 'COMPLETED') return redirectToReceipt();
            }
            return redirectToFailed();
          }
          return;
        }
        const resp = await fetch(`/api/payment-status/${txId}`);
        if (resp.ok) {
          const data = await resp.json();
          const s = String(data.status).toUpperCase();
          if (s === 'COMPLETED') {
            completed = true;
            try { popup.close(); } catch {}
            return redirectToReceipt();
          }
          if (s === 'FAILED') {
            completed = true;
            try { popup.close(); } catch {}
            return redirectToFailed();
          }
        }
      } catch {}
    };

    pollInterval = window.setInterval(poll, 3000);

    // Safety timeout after 15 minutes
    window.setTimeout(() => {
      if (!completed) {
        try { popup.close(); } catch {}
        redirectToFailed();
      }
      if (pollInterval) window.clearInterval(pollInterval);
      window.removeEventListener('message', messageListener);
    }, 15 * 60 * 1000);
  };

  const onSubmit = (data: DepositForm) => {
    if (!country || isPaymentInProgress) return;
    setIsPaymentInProgress(true);

    // Open a centered popup immediately (about:blank) to avoid blockers
    const defaultWidth = 480;
    const defaultHeight = 720;
    const width = Math.min(defaultWidth, Math.max(360, window.outerWidth - 40));
    const height = Math.min(defaultHeight, Math.max(520, window.outerHeight - 80));
    const left = (window.screenX || 0) + Math.max(0, Math.round((window.outerWidth - width) / 2));
    const top = (window.screenY || 0) + Math.max(0, Math.round((window.outerHeight - height) / 2));
    const features = `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no,location=no`;
    const popup = window.open('about:blank', 'pawapay-payment', features);

    if (!popup) {
      toast({
        title: 'Popup Blocked',
        description: 'Please allow popups for this site to complete payment',
        variant: 'destructive',
      });
      setIsPaymentInProgress(false);
      return;
    }

    // Lightweight loading UI
    popup.document.write('<html><head><title>Loading Payment...</title><meta name="viewport" content="width=device-width, initial-scale=1"/></head><body style="font-family: system-ui; text-align: center; padding: 50px; background: #f9fafb;"><div style="max-width: 300px; margin: 0 auto;"><div style="border: 4px solid #e5e7eb; border-top: 4px solid #7c3aed; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div><h2 style="color: #374151; margin-bottom: 10px;">Loading Payment...</h2><p style="color: #6b7280; font-size: 14px;">Please wait while we prepare your payment.</p></div><style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style></body></html>');

    setPaymentPopup(popup);

    // Kick off the API call; onSuccess will navigate popup
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
                Optional. Up to 22 characters; letters, numbers, spaces
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
                  ? 'Payment in Progress...'
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
