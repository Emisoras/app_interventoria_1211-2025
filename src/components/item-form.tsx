// src/components/item-form.tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Save } from 'lucide-react';
import * as React from 'react';
import { useForm } from 'react-hook-form';

import { saveInventoryItem } from '@/app/actions';
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

// This schema is for creating/editing the master item details, not for dispatching.
// We remove fields that are irrelevant for master data entry.
const MasterItemSchema = InventoryItemSchema.omit({ 
    destination: true, 
    status: true,
    // We can keep observations for master records, e.g., "scratched box".
});
type MasterItemFormData = z.infer<typeof MasterItemSchema>;

interface ItemFormProps {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    editingItem: InventoryItem | null;
    onItemSaved: () => void;
}

export function ItemForm({ isOpen, setIsOpen, editingItem, onItemSaved }: ItemFormProps) {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = React.useState(false);
    
    const form = useForm<MasterItemFormData>({
        resolver: zodResolver(MasterItemSchema),
    });

    React.useEffect(() => {
        if (isOpen) {
            form.reset(editingItem || {
                name: '',
                reference: '',
                brand: '',
                serial: '',
                quantity: 1,
                supplier: '',
                observations: '',
            });
        }
    }, [isOpen, editingItem, form]);

    const onSubmit = async (data: MasterItemFormData) => {
        setIsSaving(true);
        
        // If creating, status is always 'en_bodega'. If editing, we preserve the existing status.
        const status = editingItem ? editingItem.status : 'en_bodega';
        const destination = editingItem ? editingItem.destination : '';

        const dataToSave = { 
            ...data,
            _id: editingItem?._id,
            status,
            destination,
         };

        const result = await saveInventoryItem(dataToSave);
        setIsSaving(false);

        if (result.success) {
            toast({ title: '¡Éxito!', description: `Elemento maestro ${editingItem ? 'actualizado' : 'creado'} correctamente.` });
            onItemSaved();
            setIsOpen(false);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{editingItem ? 'Editar Elemento Maestro' : 'Nuevo Elemento de Inventario'}</DialogTitle>
                    <DialogDescription>
                        Complete los detalles del equipo o material para la base de datos central.
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-[70vh] overflow-y-auto pr-6 pl-1 -mr-6 -ml-1">
                    <Form {...form}>
                        <form id="item-master-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="name" render={({ field }) => (
                                    <FormItem><FormLabel>Nombre del Elemento</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                )}/>
                                <FormField control={form.control} name="serial" render={({ field }) => (
                                    <FormItem><FormLabel>Número de Serie</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                )}/>
                                <FormField control={form.control} name="brand" render={({ field }) => (
                                    <FormItem><FormLabel>Marca</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                )}/>
                                <FormField control={form.control} name="reference" render={({ field }) => (
                                    <FormItem><FormLabel>Referencia/Modelo</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                )}/>
                                <FormField
                                  control={form.control}
                                  name="quantity"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Cantidad</FormLabel>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          {...field}
                                          value={isNaN(field.value) ? '' : field.value}
                                          onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField control={form.control} name="supplier" render={({ field }) => (
                                    <FormItem><FormLabel>Proveedor (Opcional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                )}/>
                            </div>
                            <FormField control={form.control} name="observations" render={({ field }) => (
                                <FormItem><FormLabel>Observaciones (Opcional)</FormLabel><FormControl><Textarea placeholder="Ej. Caja en mal estado, versión de firmware, etc." {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                        </form>
                    </Form>
                </div>
                <DialogFooter className="pt-4 border-t">
                    <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                    <Button type="submit" form="item-master-form" disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                        Guardar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
