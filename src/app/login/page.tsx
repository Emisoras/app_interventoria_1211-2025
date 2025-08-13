// src/app/login/page.tsx
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
import { loginUser, type UserLoginInput } from '../actions';
import { CheckInterventoriaLogo } from '@/components/check-interventoria-logo';

const loginSchema = z.object({
  email: z.string().email('Por favor, ingrese un email válido.'),
  password: z.string().min(1, 'La contraseña es requerida.'),
});

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<UserLoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: UserLoginInput) => {
    setIsLoading(true);
    const result = await loginUser(data);
    setIsLoading(false);

    if (result.success) {
      toast({
        title: 'Inicio de Sesión Exitoso',
        description: 'Bienvenido de nuevo.',
      });
      if (result.userId) {
        localStorage.setItem('userId', result.userId);
      }
      if (result.role) {
        localStorage.setItem('userRole', result.role);
      }
      if (result.isAdmin) {
        localStorage.setItem('isAdmin', 'true');
      } else {
        localStorage.removeItem('isAdmin');
      }
      router.push('/form');
    } else {
      toast({
        variant: 'destructive',
        title: 'Error de Inicio de Sesión',
        description: result.error || 'Credenciales incorrectas. Por favor, intente de nuevo.',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md mb-8">
            <div className="flex items-center justify-center md:justify-start gap-2">
                <CheckInterventoriaLogo className="h-8 w-8 text-primary" />
                <span className="text-xl font-bold">Syntrix Software de Interventoria</span>
            </div>
        </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Iniciar Sesión</CardTitle>
          <CardDescription>Ingrese su correo y contraseña para acceder al sistema.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                Iniciar Sesión
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-center text-sm">
          <p>
            ¿No tiene una cuenta?{' '}
            <Link href="/register" className="font-semibold text-primary hover:underline">
              Regístrese aquí
            </Link>
          </p>
        </CardFooter>
      </Card>
      <footer className="w-full max-w-md mt-8 text-center text-muted-foreground text-sm">
        <p>Creado por C & J Soluciones de Ingeniería para Interventoria Convenio Interadministrativo CI-STIC-02177-2025</p>
        <p>Copyright © 2025. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}
