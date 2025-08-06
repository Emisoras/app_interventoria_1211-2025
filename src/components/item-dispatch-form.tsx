// src/components/item-dispatch-form.tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Save, Truck } from 'lucide-react';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { saveInventoryItem, getCampuses } from '@/app/actions';
import type { Campus } from '@/lib/campus-data';
import { InventoryItem, InventoryItemSchema } from '@/lib/schemas';
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
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// Schema for dispatching an item. We only need the destination and new status.
const DispatchItemSchema = InventoryItemSchema.pick({
    destination: true,
    status: true,
    observations: true,
}).required({
    destination: true,
});

type DispatchItemFormData = z.infer<typeof DispatchItemSchema>;

interface ItemDispatchFormProps {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    itemToDispatch: InventoryItem | null;
    onItemSaved: () => void;
}

export function ItemDispatchForm({ isOpen, setIsOpen, itemToDispatch, onItemSaved }: ItemDispatchFormProps) {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = React.useState(false);
    const [campuses, setCampuses] = React.useState<Campus[]>([]);
    const [openCampusesPopover, setOpenCampusesPopover] = React.useState(false);

    const form = useForm<DispatchItemFormData>({
        resolver: zodResolver(DispatchItemSchema),
    });

    React.useEffect(() => {
        if (isOpen) {
            getCampuses().then(setCampuses);
            if (itemToDispatch) {
                form.reset({
                    destination: itemToDispatch.destination || '',
                    status: 'entregado', // Default to 'entregado' on dispatch
                    observations: itemToDispatch.observations || '',
                });
            }
        }
    }, [isOpen, itemToDispatch, form]);

    const onSubmit = async (data: DispatchItemFormData) => {
        if (!itemToDispatch) return;

        setIsSaving(true);
        
        const dataToSave = { 
            ...itemToDispatch,
            destination: data.destination,
            status: data.status,
            observations: data.observations,
         };

        const result = await saveInventoryItem(dataToSave);
        setIsSaving(false);

        if (result.success) {
            toast({ title: '¡Éxito!', description: `Elemento despachado a ${data.destination}.` });
            onItemSaved();
            setIsOpen(false);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Asignar / Dar Salida a Elemento</DialogTitle>
                    <DialogDescription>
                       Asigne un destino y estado para el elemento: <span className="font-bold">{itemToDispatch?.name} (S/N: {itemToDispatch?.serial})</span>.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Form {...form}>
                        <form id="item-dispatch-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                             <FormField control={form.control} name="destination" render={({ field }) => (
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
                            )}/>
                            <FormField control={form.control} name="status" render={({ field }) => (
                                <FormItem><FormLabel>Nuevo Estado</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="entregado">Entregado</SelectItem>
                                        <SelectItem value="aprobado">Aprobado para Entrega</SelectItem>
                                        <SelectItem value="rechazado">Rechazado</SelectItem>
                                        <SelectItem value="en_bodega">Devolver a Bodega</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}/>
                            <FormField control={form.control} name="observations" render={({ field }) => (
                                <FormItem><FormLabel>Observaciones de Salida (Opcional)</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                        </form>
                    </Form>
                </div>
                <DialogFooter className="pt-4 border-t">
                    <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                    <Button type="submit" form="item-dispatch-form" disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Truck className="mr-2 h-4 w-4" />}
                        Confirmar Salida
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
