import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { pawaPayService } from "@/lib/pawapay";

interface Country {
  code: string;
  name: string;
  currency: string;
  prefix: string;
  flag: string;
}

const countries: Country[] = [
  { code: 'RWA', name: 'Rwanda', currency: 'RWF', prefix: '250', flag: '🇷🇼' },
  { code: 'UGA', name: 'Uganda', currency: 'UGX', prefix: '256', flag: '🇺🇬' },
  { code: 'KEN', name: 'Kenya', currency: 'KES', prefix: '254', flag: '🇰🇪' },
];

interface CountrySelectorProps {
  onCountrySelect: (country: Country) => void;
  selectedCountry?: Country;
}

export function CountrySelector({ onCountrySelect, selectedCountry }: CountrySelectorProps) {
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>('');

  const { data: providers, isLoading, error } = useQuery({
    queryKey: ['/api/providers', selectedCountryCode],
    enabled: !!selectedCountryCode,
  });

  const handleCountrySelect = (country: Country) => {
    setSelectedCountryCode(country.code);
    onCountrySelect(country);
  };

  return (
    <Card data-testid="country-selector">
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Select Country</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {countries.map((country) => (
            <Button
              key={country.code}
              data-testid={`country-${country.code.toLowerCase()}`}
              variant={selectedCountry?.code === country.code ? "default" : "outline"}
              className="p-4 h-auto justify-start text-left"
              onClick={() => handleCountrySelect(country)}
            >
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{country.flag}</span>
                <div>
                  <h3 className="font-medium">{country.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {country.currency} • +{country.prefix}
                  </p>
                </div>
              </div>
            </Button>
          ))}
        </div>

        {selectedCountry && (
          <div className="mt-4 p-4 bg-muted rounded-lg" data-testid="selected-country-info">
            <h4 className="font-medium text-foreground mb-2">Available Providers</h4>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading providers...</div>
            ) : error ? (
              <div className="text-sm text-destructive">Failed to load providers</div>
            ) : providers && Array.isArray(providers) && providers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="providers-list">
                {(providers as any[]).map((provider: any) => (
                  <div
                    key={provider.code}
                    data-testid={`provider-${provider.code}`}
                    className="flex items-center space-x-2 p-2 border border-border rounded"
                  >
                    <div className="w-6 h-6 bg-primary/10 rounded flex items-center justify-center">
                      <i className="fas fa-mobile-alt text-primary text-xs"></i>
                    </div>
                    <span className="text-sm text-foreground">{provider.displayName}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No providers available</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
