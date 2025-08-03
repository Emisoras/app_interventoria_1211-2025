// src/app/profile/page.tsx
'use client';

import { getUserById, updateUser, type UserUpdateInput } from '@/app/actions';
import { CheckInterventoriaLogo } from '@/components/check-interventoria-logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const profileSchema = z.object({
  _id: z.string(),
  username: z.string().min(3, 'El nombre de usuario debe tener al menos 3 caracteres.'),
  email: z.string().email(), // Email is not editable, just for display
  cedula: z.string().min(5, 'La cédula es requerida.'),
  telefono: z.string().min(7, 'El teléfono es requerido.'),
});

// We only allow updating a subset of fields
const userUpdateSchema = profileSchema.omit({ email: true });

export default function ProfilePage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  const form = useForm<UserUpdateInput>({
    resolver: zodResolver(userUpdateSchema),
    defaultValues: {
      _id: '',
      username: '',
      cedula: '',
      telefono: '',
    },
  });

  const isReadOnly = userRole === 'viewer' || userRole === 'empleado';

  useEffect(() => {
    const storedUserId = localStorage.getItem('userId');
    const role = localStorage.getItem('userRole');
    
    if (storedUserId) {
        setUserId(storedUserId);
        setUserRole(role);
    } else {
        toast({
            variant: 'destructive',
            title: 'No Autenticado',
            description: 'Por favor, inicie sesión para ver su perfil.',
        });
        router.push('/login');
    }
  }, [router, toast]);
  

  useEffect(() => {
    const fetchUserData = async () => {
      if (!userId) return;
      
      setIsFetching(true);
      const userData = await getUserById(userId);
      if (userData) {
        form.reset({
            _id: userData._id,
            username: userData.username,
            cedula: userData.cedula,
            telefono: userData.telefono,
        });
        // Set the email separately since it's not part of the update form
        (form as any).setValue('email', userData.email);
      } else {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'No se pudieron cargar los datos del usuario.'
        });
        // Potentially log out user if their ID is invalid
        localStorage.removeItem('userId');
        localStorage.removeItem('userRole');
        localStorage.removeItem('isAdmin');
        router.push('/login');
      }
      setIsFetching(false);
    };

    fetchUserData();
  }, [form, toast, userId, router]);

  const onSubmit = async (data: UserUpdateInput) => {
    if (isReadOnly) {
      toast({
        variant: 'destructive',
        title: 'Acción no permitida',
        description: 'No tiene permisos para modificar su perfil.'
      });
      return;
    }
    setIsLoading(true);
    const result = await updateUser(data);
    setIsLoading(false);

    if (result.success) {
      toast({
        title: '¡Perfil Actualizado!',
        description: 'Tus datos han sido guardados correctamente.',
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Error al Actualizar',
        description: result.error || 'No se pudo guardar tu perfil. Por favor, intente de nuevo.',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl mb-8">
        <div className="flex items-center gap-2">
            <CheckInterventoriaLogo className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">Syntrix Software de Interventoria</span>
        </div>
      </div>

       <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Mi Perfil</CardTitle>
          <CardDescription>
            {isReadOnly ? 'Aquí puede ver su información personal.' : 'Actualiza tu información personal aquí.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isFetching ? (
            <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Nombre de Usuario</FormLabel>
                        <FormControl>
                        <Input placeholder="tu_usuario" {...field} disabled={isReadOnly} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormItem>
                    <FormLabel>Correo Electrónico</FormLabel>
                    <FormControl>
                    <Input placeholder="usuario@ejemplo.com" disabled {...(form.register as any)('email')} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                <FormField
                    control={form.control}
                    name="cedula"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Cédula</FormLabel>
                        <FormControl>
                        <Input placeholder="Tu número de cédula" {...field} disabled={isReadOnly}/>
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
                        <Input placeholder="Tu número de teléfono" {...field} disabled={isReadOnly}/>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
              </div>
              {!isReadOnly && (
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={isLoading || isFetching}>
                      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Guardar Cambios
                  </Button>
                </div>
              )}
            </form>
          </Form>
          )}
        </CardContent>
        <CardFooter className="flex justify-start border-t pt-6">
            <Button asChild variant="outline">
                <Link href="/form">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver al Formulario
                </Link>
            </Button>
        </CardFooter>
      </Card>
      <footer className="w-full max-w-2xl mt-8 text-center text-muted-foreground text-sm">
        <p>Creado por C & J Soluciones de Ingeniería para Interventoria Convenio Interadminsitrativo 1211-2025</p>
        <p>Copyright © 2025. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}
