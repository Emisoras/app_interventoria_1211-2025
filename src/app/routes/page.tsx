// src/app/routes/page.tsx
'use client';

import { CheckInterventoriaLogo } from '@/components/check-interventoria-logo';
import { RoutePlanner } from '@/components/route-planner';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, LogOut, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import dynamic from 'next/dynamic';

const RouteMap = dynamic(() => import('@/components/route-map').then(mod => mod.RouteMap), {
  ssr: false,
  loading: () => <div className="h-96 w-full bg-muted rounded-lg flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /><p className="ml-4">Cargando mapa...</p></div>,
});


export default function RoutesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const storedUserId = localStorage.getItem('userId');
    const role = localStorage.getItem('userRole');

    if (!storedUserId) {
      toast({
        variant: 'destructive',
        title: 'Acceso Denegado',
        description: 'Por favor, inicie sesión para acceder a esta página.',
      });
      router.push('/login');
      return;
    }
    setUserRole(role);
    setUserId(storedUserId);
  }, [router, toast]);


  const handleLogout = () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('userRole');
    toast({
        title: 'Sesión Cerrada',
        description: 'Has cerrado sesión exitosamente.',
    });
    router.push('/login');
  };

  const canEdit = userRole === 'admin' || userRole === 'editor';

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="p-4 border-b sticky top-0 bg-background/95 backdrop-blur-sm z-10">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <CheckInterventoriaLogo className="h-8 w-8 text-primary" />
            <h1 className="text-xl md:text-2xl font-bold font-headline text-foreground">
              Gestión de Rutas de Técnicos
            </h1>
          </div>
          <div className="flex items-center gap-2">
             <Button asChild variant="outline">
              <Link href="/form">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
              </Link>
            </Button>
            <Button variant="secondary" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar Sesión
            </Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto p-4 md:p-8 flex-grow space-y-8">
        <Suspense fallback={<div className="h-96 w-full bg-muted rounded-lg flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
          <RouteMap userRole={userRole} userId={userId} />
        </Suspense>
        <RoutePlanner canEdit={canEdit} userRole={userRole} userId={userId} />
      </main>
      <footer className="py-4 border-t text-center text-muted-foreground text-sm">
        <p>Creado por C & J Soluciones de Ingeniería para Interventoria Convenio Interadministrativo CI-STIC-02177-2025</p>
        <p>Copyright © 2025. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}
