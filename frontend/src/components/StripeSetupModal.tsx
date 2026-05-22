import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useIsStripeConfigured, useSetStripeConfiguration, useIsCallerAdmin } from '../hooks/useQueries';
import { toast } from 'sonner';
import type { StripeConfiguration } from '../backend';

export default function StripeSetupModal() {
  const [secretKey, setSecretKey] = useState('');
  const [countries, setCountries] = useState('US,CA,GB,AU,DE,FR,IT,ES,NL,SE');
  const { data: isConfigured, isLoading } = useIsStripeConfigured();
  const { data: isAdmin } = useIsCallerAdmin();
  const setConfig = useSetStripeConfiguration();

  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!isLoading && isAdmin && !isConfigured) {
      setShowModal(true);
    }
  }, [isLoading, isAdmin, isConfigured]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretKey.trim()) {
      toast.error('Please enter your Stripe secret key');
      return;
    }

    const config: StripeConfiguration = {
      secretKey: secretKey.trim(),
      allowedCountries: countries.split(',').map((c) => c.trim())
    };

    try {
      await setConfig.mutateAsync(config);
      toast.success('Stripe configured successfully!');
      setShowModal(false);
    } catch (error) {
      console.error('Error configuring Stripe:', error);
      toast.error('Failed to configure Stripe');
    }
  };

  if (!showModal) return null;

  return (
    <Dialog open={showModal} onOpenChange={setShowModal}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configure Stripe Payment</DialogTitle>
          <DialogDescription>Set up Stripe to enable payment processing for flight bookings</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="secretKey">Stripe Secret Key</Label>
            <Input
              id="secretKey"
              type="password"
              placeholder="sk_test_..."
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="countries">Allowed Countries (comma-separated)</Label>
            <Input
              id="countries"
              placeholder="US,CA,GB,AU"
              value={countries}
              onChange={(e) => setCountries(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={setConfig.isPending}>
            {setConfig.isPending ? 'Configuring...' : 'Configure Stripe'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
