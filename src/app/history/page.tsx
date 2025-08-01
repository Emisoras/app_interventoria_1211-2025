// src/app/history/page.tsx
'use client';

import { deleteChecklist, getChecklists } from '@/app/actions';
import { CheckInterventoriaLogo } from '@/components/check-interventoria-logo';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Edit, Loader2, LogOut, Search, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { SuspenseWrapper } from '@/components/suspense-wrapper';


type ChecklistSummary = {
  _id: string;
  campusName: string;
  contractorName: string;
  institutionName: string;
  inspectorName: string;
  date: string;
  items: any[];
};

function HistoryPageContent() {
  const { toast } = useToast();
  const router = useRouter();
  const [checklists, setChecklists] = React.useState<ChecklistSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [userRole, setUserRole] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  
  const fetchChecklists = React.useCallback(async () => {
    setLoading(true);
    const data = await getChecklists();
    setChecklists(data);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    const userId = localStorage.getItem('userId');
    const role = localStorage.getItem('userRole');
    setUserRole(role);

    if (!userId) {
      toast({
        variant: 'destructive',
        title: 'Acceso Denegado',
        description: 'Por favor, inicie sesión para ver el historial.',
      });
      router.push('/login');
    } else {
        fetchChecklists();
    }
  }, [router, toast, fetchChecklists]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const result = await deleteChecklist(id);
    if (result.success) {
      toast({
        title: '¡Eliminado!',
        description: 'El checklist ha sido eliminado correctamente.',
      });
      fetchChecklists(); // Re-fetch the data to update the list
    } else {
      toast({
        variant: 'destructive',
        title: 'Error al Eliminar',
        description: result.error || 'Ocurrió un error inesperado. Por favor, intente de nuevo.',
      });
    }
    setDeletingId(null);
  };
  
  const getEditUrl = (checklist: ChecklistSummary) => {
    // Defensive check to prevent runtime errors if items array is missing
    if (!checklist.items || !Array.isArray(checklist.items)) {
        // Default to a viabilidad form if items are not available
        return checklist.institutionName ? `/form/viabilidad-educativa?id=${checklist._id}` : `/form/viabilidad-junta?id=${checklist._id}`;
    }
    
    const isInstalacion = checklist.items.some(item => item && item.id && item.id.startsWith('JI-'));
    if (isInstalacion) {
        return checklist.institutionName ? `/form/instalacion?id=${checklist._id}` : `/form/instalacion-junta?id=${checklist._id}`;
    } else {
        return checklist.institutionName ? `/form/viabilidad-educativa?id=${checklist._id}` : `/form/viabilidad-junta?id=${checklist._id}`;
    }
  }


  const filteredChecklists = React.useMemo(() => {
    const lowercasedFilter = searchTerm.toLowerCase();
    return checklists.filter(item => {
      return (
        item.campusName.toLowerCase().includes(lowercasedFilter) ||
        (item.institutionName && item.institutionName.toLowerCase().includes(lowercasedFilter)) ||
        item.contractorName.toLowerCase().includes(lowercasedFilter) ||
        item.inspectorName.toLowerCase().includes(lowercasedFilter)
      );
    });
  }, [checklists, searchTerm]);

  const isViewer = userRole === 'viewer';

  return (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div className="flex-1">
                <CardTitle>Registros Guardados</CardTitle>
                <CardDescription>
                  Busque y administre los checklists guardados en la base de datos.
                </CardDescription>
              </div>
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por sede, contratista..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Sede Educativa / Junta</TableHead>
                    <TableHead>Institución</TableHead>
                    <TableHead>Contratista</TableHead>
                    <TableHead>Interventor</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center h-24">
                            <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                            <p>Cargando registros...</p>
                            </TableCell>
                        </TableRow>
                    ) : filteredChecklists.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center h-24">
                            {searchTerm ? `No se encontraron resultados para "${searchTerm}"` : 'No hay registros guardados.'}
                            </TableCell>
                        </TableRow>
                    ) : (
                    filteredChecklists.map((checklist) => (
                        <TableRow key={checklist._id}>
                        <TableCell className="font-medium">{checklist.campusName}</TableCell>
                        <TableCell>{checklist.institutionName || 'N/A'}</TableCell>
                        <TableCell>{checklist.contractorName}</TableCell>
                        <TableCell>{checklist.inspectorName}</TableCell>
                        <TableCell>{format(new Date(checklist.date), 'PPP', { locale: es })}</TableCell>
                        <TableCell className="text-right">
                            <div className="flex justify-end items-center gap-2">
                                <Button asChild variant="ghost" size="sm">
                                <Link href={getEditUrl(checklist)}>
                                    <Edit className="mr-2 h-4 w-4"/>
                                    {isViewer ? 'Ver' : 'Cargar'}
                                </Link>
                                </Button>
                                {!isViewer && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                        {deletingId === checklist._id ? (
                                          <Loader2 className="h-4 w-4 animate-spin"/>
                                        ) : (
                                          <Trash2 className="h-4 w-4"/>
                                        )}
                                      </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                      <AlertDialogHeader>
                                      <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                          Esta acción no se puede deshacer. Esto eliminará permanentemente el checklist de la base de datos.
                                      </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDelete(checklist._id)}>
                                          Eliminar
                                      </AlertDialogAction>
                                      </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                                )}
                            </div>
                        </TableCell>
                        </TableRow>
                    ))
                    )}
                </TableBody>
                </Table>
            </div>
          </CardContent>
        </Card>
  );
}


export default function HistoryPage() {
    const router = useRouter();
    const { toast } = useToast();

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

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            <header className="p-4 border-b sticky top-0 bg-background/95 backdrop-blur-sm z-10">
                <div className="container mx-auto flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <CheckInterventoriaLogo className="h-8 w-8 text-primary" />
                    <h1 className="text-xl md:text-2xl font-bold font-headline text-foreground">
                    Historial de Checklists
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
            <main className="container mx-auto p-4 md:p-8 flex-grow">
                <SuspenseWrapper>
                    <HistoryPageContent />
                </SuspenseWrapper>
            </main>
            <footer className="py-4 border-t text-center text-muted-foreground text-sm">
                <p>Creado por C & J Soluciones de Ingeniería para Interventoria Convenio Interadminsitrativo 1211-2025</p>
                <p>Copyright © 2025. Todos los derechos reservados.</p>
            </footer>
        </div>
    );
}
