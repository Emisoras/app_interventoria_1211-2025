// src/app/admin/page.tsx
'use client';

import { getAllUsers, toggleUserStatus, updateUserByAdmin, deleteUserById, type AdminUpdateUserInput } from '@/app/actions';
import { CheckInterventoriaLogo } from '@/components/check-interventoria-logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Edit, Loader2, LogOut, Save, Trash2, UserCog, Ban, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const adminUpdateUserSchema = z.object({
  _id: z.string(),
  username: z.string().min(3, 'El nombre de usuario debe tener al menos 3 caracteres.'),
  cedula: z.string().min(5, 'La cédula es requerida.'),
  telefono: z.string().min(7, 'El teléfono es requerido.'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.').optional().or(z.literal('')),
  role: z.enum(['admin', 'editor', 'viewer', 'empleado', 'tecnico_campo']),
});


type User = {
  _id: string;
  username: string;
  email: string;
  cedula: string;
  telefono: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'blocked';
  role?: 'editor' | 'viewer' | 'admin' | 'empleado' | 'tecnico_campo';
};

type UserWithRoleChange = User & { roleToAssign?: 'editor' | 'viewer' | 'admin' | 'empleado' | 'tecnico_campo' };

export default function AdminPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [users, setUsers] = React.useState<UserWithRoleChange[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [processingId, setProcessingId] = React.useState<string | null>(null);
  const [adminId, setAdminId] = React.useState<string | null>(null);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = React.useState(false);
  const [selectedUser, setSelectedUser] = React.useState<User | null>(null);

  const form = useForm<AdminUpdateUserInput>({
    resolver: zodResolver(adminUpdateUserSchema),
    defaultValues: {
      _id: '',
      username: '',
      cedula: '',
      telefono: '',
      password: '',
      role: 'viewer',
    },
  });


  const fetchUsers = React.useCallback(async (id: string) => {
    setLoading(true);
    const data: User[] = await getAllUsers(id);
    setUsers(data.map(u => ({ ...u, roleToAssign: u.role })));
    setLoading(false);
  }, []);

  React.useEffect(() => {
    const isAdmin = localStorage.getItem('isAdmin') === 'true';
    const storedAdminId = localStorage.getItem('userId');
    if (!isAdmin || !storedAdminId) {
      toast({
        variant: 'destructive',
        title: 'Acceso Denegado',
        description: 'No tiene permisos para acceder a esta página.',
      });
      router.push('/login');
    } else {
        setAdminId(storedAdminId);
        fetchUsers(storedAdminId);
    }
  }, [router, toast, fetchUsers]);

  const handleRoleChange = (userId: string, role: 'editor' | 'viewer' | 'admin' | 'empleado' | 'tecnico_campo') => {
    setUsers(users.map(u => u._id === userId ? { ...u, roleToAssign: role } : u));
  };

  const handleToggleStatus = async (user: User) => {
    if (user.status !== 'approved' && user.status !== 'blocked') return;
    setProcessingId(user._id);
    const result = await toggleUserStatus(user._id, user.status);
     if (result.success) {
      toast({
        title: '¡Estado Actualizado!',
        description: `El usuario ha sido ${user.status === 'approved' ? 'bloqueado' : 'desbloqueado'}.`,
      });
      if(adminId) fetchUsers(adminId);
    } else {
      toast({
        variant: 'destructive',
        title: 'Error al Cambiar Estado',
        description: result.error || 'Ocurrió un error inesperado.',
      });
    }
    setProcessingId(null);
  };
  
  const handleDelete = async (id: string) => {
    setProcessingId(id);
    const result = await deleteUserById(id);
    if (result.success) {
      toast({
        title: '¡Usuario Eliminado!',
        description: 'El usuario ha sido eliminado correctamente.',
      });
      if(adminId) fetchUsers(adminId);
    } else {
      toast({
        variant: 'destructive',
        title: 'Error al Eliminar',
        description: result.error || 'Ocurrió un error inesperado.',
      });
    }
    setProcessingId(null);
  };
  
  const handleOpenUpdateDialog = (user: User) => {
    setSelectedUser(user);
    form.reset({
      _id: user._id,
      username: user.username,
      cedula: user.cedula,
      telefono: user.telefono,
      password: '',
      role: user.role,
    });
    setIsUpdateDialogOpen(true);
  };
  
  const onUpdateSubmit = async (data: AdminUpdateUserInput) => {
    setProcessingId(data._id);
    const result = await updateUserByAdmin(data);
    if (result.success) {
        toast({
            title: '¡Usuario Actualizado!',
            description: 'Los datos del usuario han sido actualizados.',
        });
        if(adminId) fetchUsers(adminId);
        setIsUpdateDialogOpen(false);
        setSelectedUser(null);
    } else {
         toast({
            variant: 'destructive',
            title: 'Error al Actualizar',
            description: result.error || 'Ocurrió un error inesperado.',
        });
    }
    setProcessingId(null);
  };

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
              Panel de Administración
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
        <div className="flex justify-end mb-6">
            <Button asChild>
                <Link href="/admin/questions">
                    <Edit className="mr-2 h-4 w-4" />
                    Administrar Preguntas de Checklist
                </Link>
            </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Gestión de Usuarios</CardTitle>
            <CardDescription>
              Aquí puede ver todos los usuarios, cambiar sus roles o eliminarlos del sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Nombre de Usuario</TableHead>
                    <TableHead>Email y Contacto</TableHead>
                    <TableHead>Estado y Rol</TableHead>
                    <TableHead>Fecha de Creación</TableHead>
                    <TableHead className="text-right pr-6">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center h-24">
                             <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                             Cargando usuarios...
                            </TableCell>
                        </TableRow>
                    ) : users.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center h-24">
                            No hay usuarios registrados.
                            </TableCell>
                        </TableRow>
                    ) : (
                    users.map((user) => (
                        <TableRow key={user._id}>
                          <TableCell className="font-medium">
                            <div className="font-medium">{user.username}</div>
                            <div className="text-sm text-muted-foreground">C.C. {user.cedula}</div>
                          </TableCell>
                          <TableCell>
                            <div>{user.email}</div>
                            <div className="text-sm text-muted-foreground">Tel: {user.telefono}</div>
                          </TableCell>
                           <TableCell>
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                    user.status === 'pending' ? 'bg-yellow-200 text-yellow-800' :
                                    user.status === 'blocked' ? 'bg-red-200 text-red-800' :
                                    user.role === 'admin' ? 'bg-blue-200 text-blue-800' : 
                                    user.role === 'editor' ? 'bg-green-200 text-green-800' :
                                    user.role === 'empleado' ? 'bg-purple-200 text-purple-800' :
                                    user.role === 'tecnico_campo' ? 'bg-indigo-200 text-indigo-800' :
                                    user.role === 'viewer' ? 'bg-gray-200 text-gray-800' : 'bg-gray-100'
                                }`}>
                                {user.status === 'pending' ? 'Pendiente' : 
                                 user.status === 'blocked' ? 'Bloqueado' :
                                 user.role || 'No asignado'}
                                </span>
                           </TableCell>
                          <TableCell>{user.createdAt ? format(new Date(user.createdAt), 'PPP', { locale: es }) : '-'}</TableCell>
                          <TableCell className="text-right">
                              <div className="flex justify-end items-center gap-1">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => handleOpenUpdateDialog(user)}
                                    disabled={processingId === user._id}
                                    title="Actualizar Usuario"
                                  >
                                    <UserCog className="h-4 w-4"/>
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className={user.status === 'blocked' ? "text-green-600 hover:text-green-700" : "text-orange-600 hover:text-orange-700"}
                                    onClick={() => handleToggleStatus(user)}
                                    disabled={processingId === user._id || user.status === 'pending'}
                                    title={user.status === 'blocked' ? 'Desbloquear Usuario' : 'Bloquear Usuario'}
                                  >
                                    {processingId === user._id ? <Loader2 className="h-4 w-4 animate-spin"/> : (user.status === 'blocked' ? <ShieldCheck className="h-4 w-4"/> : <Ban className="h-4 w-4"/>)}
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="text-destructive hover:text-destructive"
                                            disabled={processingId === user._id}
                                            title="Eliminar Usuario"
                                        >
                                          {processingId === user._id ? '' : <Trash2 className="h-4 w-4"/>}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>¿Está absolutamente seguro?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Esta acción no se puede deshacer. Esto eliminará permanentemente la cuenta de <strong>{user.username}</strong> y todos sus datos asociados.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDelete(user._id)} className="bg-destructive hover:bg-destructive/90">
                                          Sí, eliminar usuario
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
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
      </main>
      <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Actualizar Usuario</DialogTitle>
                    <DialogDescription>
                        Modifique los datos del usuario. Deje la contraseña en blanco para no cambiarla.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onUpdateSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="username"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre de Usuario</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="cedula"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cédula</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="telefono"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Teléfono</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nueva Contraseña (Opcional)</FormLabel>
                                    <FormControl>
                                        <Input type="password" {...field} placeholder="Dejar en blanco para no cambiar" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="role"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Rol</FormLabel>
                                    <Select 
                                        onValueChange={field.onChange} 
                                        defaultValue={field.value}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccione un rol" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="admin">Admin</SelectItem>
                                            <SelectItem value="editor">Editor</SelectItem>
                                            <SelectItem value="empleado">Empleado</SelectItem>
                                            <SelectItem value="tecnico_campo">Técnico de Campo</SelectItem>
                                            <SelectItem value="viewer">Visualizador</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsUpdateDialogOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={processingId === selectedUser?._id}>
                               {processingId === selectedUser?._id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                               Guardar Cambios
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
      <footer className="py-4 border-t text-center text-muted-foreground text-sm">
        <p>Creado por C & J Soluciones de Ingeniería para Interventoria Convenio Interadministrativo CI-STIC-02177-2025</p>
        <p>Copyright © 2025. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}
