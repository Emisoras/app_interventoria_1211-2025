// src/components/item-bulk-dispatch-form.tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Truck } from 'lucide-react';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { bulkUpdateInventoryItemsStatus, getCampuses } from '@/app/actions';
import type { Campus } from '@/lib/campus-data';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const BulkDispatchSchema = z.object({
  destination: z.string().min(1, 'Debe seleccionar un destino.'),
});

type BulkDispatchFormData = z.infer<typeof BulkDispatchSchema>;

interface ItemBulkDispatchFormProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  itemsToDispatch: string[];
  onItemsDispatched: () => void;
}

export function ItemBulkDispatchForm({ isOpen, setIsOpen, itemsToDispatch, onItemsDispatched }: ItemBulkDispatchFormProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = React.useState(false);
  const [campuses, setCampuses] = React.useState<Campus[]>([]);
  const [openCampusesPopover, setOpenCampusesPopover] = React.useState(false);

  const form = useForm<BulkDispatchFormData>({
    resolver: zodResolver(BulkDispatchSchema),
  });

  React.useEffect(() => {
    if (isOpen) {
      getCampuses().then(setCampuses);
    }
  }, [isOpen]);

  const onSubmit = async (data: BulkDispatchFormData) => {
    setIsSaving(true);
    const result = await bulkUpdateInventoryItemsStatus(itemsToDispatch, data.destination, 'entregado');
    setIsSaving(false);

    if (result.success) {
      toast({
        title: '¡Despacho Exitoso!',
        description: `${result.modifiedCount} elemento(s) han sido despachados a ${data.destination}.`,
      });
      onItemsDispatched();
      setIsOpen(false);
    } else {
      toast({ variant: 'destructive', title: 'Error en el Despacho', description: result.error });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Despacho Masivo de Elementos</DialogTitle>
          <DialogDescription>
            Seleccione un destino para los {itemsToDispatch.length} elementos seleccionados. Todos cambiarán su estado a "Entregado".
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Form {...form}>
            <form id="item-bulk-dispatch-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="destination"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Ubicación de Destino</FormLabel>
                    <Popover open={openCampusesPopover} onOpenChange={setOpenCampusesPopover}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                          >
                            {field.value
                              ? campuses.find((campus) => campus.name === field.value)?.name
                              : "Seleccione una Sede/Junta"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                          <CommandInput placeholder="Buscar Sede/Junta..." />
                          <CommandList>
                            <CommandEmpty>No se encontró la Sede/Junta.</CommandEmpty>
                            <CommandGroup>
                              {campuses.map((campus) => (
                                <CommandItem
                                  value={campus.name}
                                  key={campus._id}
                                  onSelect={() => {
                                    form.setValue("destination", campus.name);
                                    setOpenCampusesPopover(false);
                                  }}
                                >
                                  <Check
                                    className={cn("mr-2 h-4 w-4", campus.name === field.value ? "opacity-100" : "opacity-0")}
                                  />
                                  {campus.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>
        <DialogFooter className="pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
          <Button type="submit" form="item-bulk-dispatch-form" disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}
            Confirmar Despacho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
