import { useNavigate } from '@tanstack/react-router';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { XCircle } from 'lucide-react';

export default function PaymentFailurePage() {
  const navigate = useNavigate();

  return (
    <div className="container py-16">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="p-12 text-center">
            <XCircle className="h-24 w-24 mx-auto text-red-600 mb-6" />
            <h1 className="text-3xl font-bold mb-4">Payment Failed</h1>
            <p className="text-lg text-muted-foreground mb-8">
              Unfortunately, your payment could not be processed. Please try again or contact support if the problem
              persists.
            </p>

            <div className="flex gap-4 justify-center">
              <Button onClick={() => navigate({ to: '/' })} className="bg-blue-600 hover:bg-blue-700">
                Try Again
              </Button>
              <Button onClick={() => navigate({ to: '/my-bookings' })} variant="outline">
                View My Bookings
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
