import React from 'react';

// No-op provider for Web
export const StripeProvider: React.FC<{
  children: React.ReactNode;
  publishableKey?: string;
  merchantIdentifier?: string;
}> = ({ children }) => {
  return <>{children}</>;
};

// No-op hook for Web
export const useStripe = () => {
  return {
    initPaymentSheet: async (_params: any) => ({ 
      error: { message: 'Stripe is not supported on web.', code: 'Failed' } 
    }),
    presentPaymentSheet: async () => ({ 
      error: { message: 'Stripe is not supported on web.', code: 'Failed' } 
    }),
    confirmPayment: async (_params: any) => ({ 
      error: { message: 'Stripe is not supported on web.', code: 'Failed' } 
    }),
  };
};
