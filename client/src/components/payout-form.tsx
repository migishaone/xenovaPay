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
import { Send, Phone, CreditCard, DollarSign, MessageSquare, Sparkles } from "lucide-react";

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


  return (
    <div className="max-w-2xl mx-auto">
      {/* Payout Form */}
      <Card data-testid="payout-form" className="glass-card border-0 shadow-2xl overflow-hidden">
        <CardContent className="p-8 relative">
          {/* Purple gradient top border */}
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-600"></div>
          
          <div className="text-center mb-8">
            <h3 className="text-3xl font-bold bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 bg-clip-text text-transparent mb-2">
              Send Payout
            </h3>
            <p className="text-muted-foreground text-sm">
              Send money securely to mobile wallets across Africa
            </p>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="payout-phone" className="text-sm font-medium text-foreground flex items-center gap-2">
                <Phone className="h-4 w-4 text-purple-600" />
                Recipient Phone Number
              </Label>
              <div className="flex">
                <span className="inline-flex items-center px-4 text-sm text-muted-foreground bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-r-0 border-purple-200 dark:border-purple-800 rounded-l-xl font-medium">
                  +{country?.prefix || '250'}
                </span>
                <Input
                  id="payout-phone"
                  data-testid="input-payout-phone"
                  {...register("phoneNumber")}
                  className="flex-1 rounded-l-none rounded-r-xl border-purple-200 dark:border-purple-800 focus:ring-purple-500 focus:border-purple-500 h-12 px-4 text-base"
                  placeholder="783456789"
                  disabled={!country}
                />
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-purple-500" />
                Enter recipient's phone number without country code
              </p>
              {errors.phoneNumber && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  ⚠️ {errors.phoneNumber.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="payout-provider" className="text-sm font-medium text-foreground flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-purple-600" />
                Payment Provider
              </Label>
              <Select 
                onValueChange={(value) => setValue("provider", value)}
                disabled={!country || providers.length === 0}
              >
                <SelectTrigger data-testid="select-payout-provider" className="h-12 rounded-xl border-purple-200 dark:border-purple-800 focus:ring-purple-500 focus:border-purple-500">
                  <SelectValue placeholder="Select mobile money provider" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-purple-200 dark:border-purple-800">
                  {providers.map((provider) => (
                    <SelectItem key={provider.code} value={provider.code} className="rounded-lg">
                      {provider.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-2">
                <p className="text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Provider will be auto-predicted from phone number
                </p>
              </div>
              {errors.provider && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  ⚠️ {errors.provider.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="payout-amount" className="text-sm font-medium text-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-purple-600" />
                Payout Amount
              </Label>
              <div className="relative">
                <Input
                  id="payout-amount"
                  data-testid="input-payout-amount"
                  {...register("amount")}
                  type="number"
                  className="h-12 rounded-xl border-purple-200 dark:border-purple-800 focus:ring-purple-500 focus:border-purple-500 pr-16 pl-4 text-base font-medium"
                  placeholder="100"
                  min="5"
                  disabled={!country}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                  <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                    {country?.currency || 'RWF'}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Minimum amount: 5 {country?.currency || 'RWF'}
              </p>
              {errors.amount && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  ⚠️ {errors.amount.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="payout-description" className="text-sm font-medium text-foreground flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-purple-600" />
                Description (Optional)
              </Label>
              <Input
                id="payout-description"
                data-testid="input-payout-description"
                {...register("description")}
                className="h-12 rounded-xl border-purple-200 dark:border-purple-800 focus:ring-purple-500 focus:border-purple-500 px-4 text-base"
                placeholder="Payout for services rendered"
                disabled={!country}
              />
              <p className="text-xs text-muted-foreground">
                Add a note about this payout (optional)
              </p>
            </div>

            <div className="pt-4">
              <Button 
                type="submit" 
                data-testid="button-initiate-payout"
                className="w-full gradient-button h-14 text-lg font-semibold rounded-xl shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300" 
                disabled={!country || isSubmitting}
              >
                <Send className="mr-3 h-5 w-5" />
                <span>{isSubmitting ? 'Processing Payout...' : 'Send Payout'}</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
