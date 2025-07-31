// src/app/register/page.tsx
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { registerUser, type UserRegisterInput } from '../actions';
import { CheckInterventoriaLogo } from '@/components/check-interventoria-logo';

const registerSchema = z.object({
  username: z.string().min(3, 'El nombre de usuario debe tener al menos 3 caracteres.'),
  email: z.string().email('Por favor, ingrese un email válido.'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.'),
  cedula: z.string().min(5, 'La cédula es requerida.'),
  telefono: z.string().min(7, 'El teléfono es requerido.'),
});

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<UserRegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      cedula: '',
      telefono: '',
    },
  });

  const onSubmit = async (data: UserRegisterInput) => {
    setIsLoading(true);
    const result = await registerUser(data);
    setIsLoading(false);

    if (result.success) {
        if (result.pending) {
            toast({
                title: 'Registro Enviado',
                description: 'Su cuenta ha sido creada y está pendiente de aprobación por un administrador.',
            });
        } else {
             toast({
                title: 'Registro Exitoso',
                description: 'Su cuenta ha sido creada. Ahora puede iniciar sesión.',
            });
        }
      router.push('/login');
    } else {
      toast({
        variant: 'destructive',
        title: 'Error de Registro',
        description: result.error || 'No se pudo crear la cuenta. Por favor, intente de nuevo.',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md mb-8">
        <div className="flex items-center justify-center md:justify-start gap-2">
            <CheckInterventoriaLogo className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">Check Interventoria</span>
        </div>
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Crear una Cuenta</CardTitle>
          <CardDescription>Ingrese sus datos para registrarse en el sistema. Su cuenta requerirá aprobación de un administrador.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de Usuario</FormLabel>
                    <FormControl>
                      <Input placeholder="su_usuario" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correo Electrónico</FormLabel>
                    <FormControl>
                      <Input placeholder="usuario@ejemplo.com" {...field} />
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
                      <Input placeholder="Su número de cédula" {...field} />
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
                      <Input placeholder="Su número de teléfono" {...field} />
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
                    <FormLabel>Contraseña</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Registrarse
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-center text-sm">
          <p>
            ¿Ya tiene una cuenta?{' '}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Inicie sesión aquí
            </Link>
          </p>
        </CardFooter>
      </Card>
      <footer className="w-full max-w-md mt-8 text-center text-muted-foreground text-sm">
            <p>Creado por C & J Soluciones de Ingeniería para Interventoria Convenio Interadminsitrativo 1211-2025</p>
            <p>Copyright © 2025. Todos los derechos reservados.</p>
        </footer>
    </div>
  );
}
