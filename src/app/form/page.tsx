// src/app/form/page.tsx
'use client';

import { CheckInterventoriaLogo } from '@/components/check-interventoria-logo';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { BookUser, CheckSquare, History, LogOut, UserCircle, Wrench, CalendarDays, GanttChartSquare } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function FormPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      toast({
        variant: 'destructive',
        title: 'Acceso Denegado',
        description: 'Por favor, inicie sesión para acceder a esta página.',
      });
      router.push('/login');
      return;
    }
    const adminStatus = localStorage.getItem('isAdmin') === 'true';
    const role = localStorage.getItem('userRole');
    setIsAdmin(adminStatus);
    setUserRole(role);
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
        <div className="container mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <CheckInterventoriaLogo className="h-8 w-8 text-primary" />
            <h1 className="text-xl md:text-2xl font-bold font-headline text-foreground">
              Syntrix Software de Interventoria
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/history">
                <History className="mr-2 h-4 w-4" />
                Historial
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary">
                  <UserCircle className="mr-2 h-4 w-4" />
                   Mi Cuenta
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Opciones</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin">
                      <BookUser className="mr-2 h-4 w-4" />
                      Administrar Usuarios
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                   <Link href="/profile">
                    <UserCircle className="mr-2 h-4 w-4" />
                    Mi Perfil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Cerrar Sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <main className="container mx-auto p-4 md:p-8 flex-grow flex flex-col justify-center items-center">
        <div className="w-full max-w-4xl space-y-8">
          {canEdit && (
            <>
              <div>
                  <h2 className="text-xl font-semibold mb-4 text-center">Planificación y Seguimiento</h2>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Button asChild size="lg" variant="secondary">
                          <Link href="/schedule" className="h-20 text-lg flex-col md:flex-row">
                              <GanttChartSquare className="mr-0 mb-2 md:mb-0 md:mr-3 h-6 w-6" />
                              Cronograma del Proyecto
                          </Link>
                      </Button>
                      <Button asChild size="lg" variant="secondary">
                          <Link href="/activities" className="h-20 text-lg flex-col md:flex-row">
                              <CalendarDays className="mr-0 mb-2 md:mb-0 md:mr-3 h-6 w-6" />
                              Actividades Diarias
                          </Link>
                      </Button>
                  </div>
              </div>
              <div>
                  <h2 className="text-xl font-semibold mb-4 text-center">Estudios de Campo (Viabilidad)</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Button asChild size="lg" variant="outline">
                          <Link href="/form/viabilidad-educativa" className="h-20 text-lg flex-col md:flex-row">
                              <CheckSquare className="mr-0 mb-2 md:mb-0 md:mr-3 h-6 w-6" />
                              Check de Viabilidad Educativa
                          </Link>
                      </Button>
                      <Button asChild size="lg" variant="outline">
                          <Link href="/form/viabilidad-junta" className="h-20 text-lg flex-col md:flex-row">
                              <CheckSquare className="mr-0 mb-2 md:mb-0 md:mr-3 h-6 w-6" />
                              Check de Viabilidad Junta
                          </Link>
                      </Button>
                  </div>
              </div>
              <div>
                  <h2 className="text-xl font-semibold mb-4 text-center">Instalación</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Button asChild size="lg">
                          <Link href="/form/instalacion" className="h-20 text-lg flex-col md:flex-row">
                              <Wrench className="mr-0 mb-2 md:mb-0 md:mr-3 h-6 w-6" />
                              Check de Instalación Educativa
                          </Link>
                      </Button>
                      <Button asChild size="lg">
                          <Link href="/form/instalacion-junta" className="h-20 text-lg flex-col md:flex-row">
                              <Wrench className="mr-0 mb-2 md:mb-0 md:mr-3 h-6 w-6" />
                              Check de Instalación Junta
                          </Link>
                      </Button>
                  </div>
              </div>
            </>
          )}

          {(userRole === 'empleado') && (
             <div>
                <h2 className="text-xl font-semibold mb-4 text-center">Reportes</h2>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button asChild size="lg" variant="secondary">
                        <Link href="/activities" className="h-20 text-lg flex-col md:flex-row">
                            <CalendarDays className="mr-0 mb-2 md:mb-0 md:mr-3 h-6 w-6" />
                            Actividades Diarias
                        </Link>
                    </Button>
                </div>
            </div>
          )}
        </div>
      </main>
      <footer className="py-4 border-t text-center text-muted-foreground text-sm">
        <p>Creado por C & J Soluciones de Ingeniería para Interventoria Convenio Interadminsitrativo 1211-2025</p>
        <p>Copyright © 2025. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}
