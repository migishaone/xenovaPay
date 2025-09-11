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
import { NotebookPen } from "lucide-react";

const payoutSchema = z.object({
  phoneNumber: z.string().min(9, "Phone number must be at least 9 digits"),
  provider: z.string().min(1, "Please select a provider"),
  amount: z.string().min(1, "Amount is required").refine(val => !isNaN(Number(val)) && Number(val) > 0, "Amount must be a positive number"),
  description: z.string().optional(),
});

type PayoutForm = z.infer<typeof payoutSchema>;

interface PayoutFormProps {
  country?: {
    code: string;
    name: string;
    currency: string;
    prefix: string;
  };
  providers: any[];
}

export function PayoutForm({ country, providers }: PayoutFormProps) {
  const [transactionId, setTransactionId] = useState<string>('');
  const [status, setStatus] = useState<string>('Ready');
  const [response, setResponse] = useState<string>('{\n  "message": "Click \'Initiate Payout\' to see API response"\n}');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PayoutForm>({
    resolver: zodResolver(payoutSchema),
  });

  const phoneNumber = watch("phoneNumber");

  // Predict provider when phone number changes
  useEffect(() => {
    if (phoneNumber && phoneNumber.length >= 9 && country) {
      const fullPhoneNumber = country.prefix + phoneNumber.replace(/\D/g, '');
      
      pawaPayService.predictProvider(fullPhoneNumber)
        .then((prediction) => {
          setValue("provider", prediction.provider);
          toast({
            title: "Provider Predicted",
            description: `Auto-selected ${prediction.provider}`,
          });
        })
        .catch(() => {
          // Silently handle prediction errors
        });
    }
  }, [phoneNumber, country, setValue, toast]);

  const payoutMutation = useMutation({
    mutationFn: async (data: PayoutForm) => {
      if (!country) throw new Error("Please select a country first");
      
      const fullPhoneNumber = country.prefix + data.phoneNumber.replace(/\D/g, '');
      
      return pawaPayService.initiatePayout({
        phoneNumber: fullPhoneNumber,
        provider: data.provider,
        amount: data.amount,
        currency: country.currency,
        description: data.description,
      });
    },
    onSuccess: (data) => {
      setTransactionId(data.transactionId);
      setStatus(data.status || 'ACCEPTED');
      setResponse(JSON.stringify(data, null, 2));
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      
      toast({
        title: "Payout Initiated",
        description: `Transaction ID: ${data.transactionId}`,
      });

      // Poll for status updates
      if (data.transactionId) {
        const pollStatus = () => {
          pawaPayService.checkPayoutStatus(data.transactionId)
            .then((statusData) => {
              setStatus(statusData.status);
              setResponse(JSON.stringify(statusData, null, 2));
              
              if (statusData.status === 'COMPLETED' || statusData.status === 'FAILED') {
                queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
                return;
              }
              
              // Continue polling if still pending
              if (statusData.status === 'PENDING' || statusData.status === 'ACCEPTED') {
                setTimeout(pollStatus, 3000);
              }
            })
            .catch(() => {
              // Stop polling on error
            });
        };
        
        setTimeout(pollStatus, 2000);
      }
    },
    onError: (error) => {
      setStatus('FAILED');
      setResponse(JSON.stringify({ error: error.message }, null, 2));
      
      toast({
        title: "Payout Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PayoutForm) => {
    payoutMutation.mutate(data);
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'COMPLETED': return 'bg-green-100 text-green-800 border-green-300';
      case 'PENDING': 
      case 'ACCEPTED': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'FAILED': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Payout Form */}
      <Card data-testid="payout-form">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Test Payout</h3>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="payout-phone">Recipient Phone Number</Label>
              <div className="flex">
                <span className="inline-flex items-center px-3 text-sm text-muted-foreground bg-muted border border-r-0 border-border rounded-l-md">
                  +{country?.prefix || '250'}
                </span>
                <Input
                  id="payout-phone"
                  data-testid="input-payout-phone"
                  {...register("phoneNumber")}
                  className="flex-1 rounded-l-none"
                  placeholder="783456789"
                  disabled={!country}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Enter recipient's phone number without country code
              </p>
              {errors.phoneNumber && (
                <p className="mt-1 text-xs text-destructive">{errors.phoneNumber.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="payout-provider">Provider</Label>
              <Select 
                onValueChange={(value) => setValue("provider", value)}
                disabled={!country || providers.length === 0}
              >
                <SelectTrigger data-testid="select-payout-provider">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((provider) => (
                    <SelectItem key={provider.code} value={provider.code}>
                      {provider.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-green-600">
                <i className="fas fa-magic mr-1"></i>Provider will be auto-predicted
              </p>
              {errors.provider && (
                <p className="mt-1 text-xs text-destructive">{errors.provider.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="payout-amount">Amount</Label>
              <div className="relative">
                <Input
                  id="payout-amount"
                  data-testid="input-payout-amount"
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
              <Label htmlFor="payout-description">Description (Optional)</Label>
              <Input
                id="payout-description"
                data-testid="input-payout-description"
                {...register("description")}
                placeholder="Payout for services"
                disabled={!country}
              />
            </div>

            <Button 
              type="submit" 
              data-testid="button-initiate-payout"
              className="w-full" 
              disabled={!country || isSubmitting}
            >
              <NotebookPen className="mr-2 h-4 w-4" />
              {isSubmitting ? 'Initiating...' : 'Initiate Payout'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* API Response */}
      <Card data-testid="payout-response">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">API Response</h3>
          <div className="space-y-4">
            <div className="bg-muted rounded-md p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Status</span>
                <span 
                  data-testid="payout-status"
                  className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(status)}`}
                >
                  {status}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                <span>Transaction ID: </span>
                <code 
                  data-testid="payout-transaction-id"
                  className="text-xs bg-background px-2 py-1 rounded"
                >
                  {transactionId || '-'}
                </code>
              </div>
            </div>

            <div>
              <Label>Full Response</Label>
              <pre 
                data-testid="payout-response-json"
                className="bg-slate-900 text-slate-100 text-xs p-3 rounded-md border border-border overflow-x-auto min-h-[200px] font-mono"
              >
                {response}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
