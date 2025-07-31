'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

export function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
        <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    }>
      {children}
    </Suspense>
  );
}