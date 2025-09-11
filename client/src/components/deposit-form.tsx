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
import { NotebookPen, ExternalLink } from "lucide-react";

const depositSchema = z.object({
  phoneNumber: z.string().min(9, "Phone number must be at least 9 digits"),
  provider: z.string().optional(),
  amount: z.string().min(1, "Amount is required").refine(val => !isNaN(Number(val)) && Number(val) > 0, "Amount must be a positive number"),
  description: z.string()
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
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      
      // Redirect to PawaPay hosted payment page
      setStatus('REDIRECTING');
      
      toast({
        title: "Redirecting to Payment Page",
        description: `Transaction ID: ${data.transactionId}`,
      });
      
      // Redirect after a short delay
      setTimeout(() => {
        window.location.href = data.redirectUrl;
      }, 1500);
    },
    onError: (error) => {
      setStatus('FAILED');
      
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: DepositForm) => {
    depositMutation.mutate(data);
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
    <div className="max-w-md mx-auto">
      <Card data-testid="payment-form">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Receive Payment</h3>
          

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                Only letters, numbers and spaces allowed
              </p>
              {errors.description && (
                <p className="mt-1 text-xs text-destructive">{errors.description.message}</p>
              )}
            </div>

            <Button 
              type="submit" 
              data-testid="button-pay-now"
              className="w-full" 
              disabled={!country || isSubmitting}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              {isSubmitting ? 'Processing...' : 'Pay Now'}
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
                {status === 'REDIRECTING' ? 'Redirecting...' : status}
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
