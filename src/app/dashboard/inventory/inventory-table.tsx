
'use client';

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getFilteredRowModel,
  ColumnFiltersState,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, Trash2, Edit, CalendarIcon, Filter, Plus, Minus } from 'lucide-react';
import { format } from 'date-fns';
import { Bay } from '../bookings/bay-status';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';

export const itemTypes = ["Sim Equipment", "Clubs", "Balls", "Supplies", "Misc"] as const;
export type ItemType = (typeof itemTypes)[number];

export const statuses = ["available", "inUse", "underRepair", "consumed"] as const;
export type ItemStatus = (typeof statuses)[number];


export interface InventoryItem {
    id: string;
    type: ItemType;
    itemName: string;
    model?: string;
    brand?: string;
    serialNumber?: string;
    notes?: string;
    quantity: number;
    assignedBayId?: string;
    assignedBayName?: string;
    status: ItemStatus;
    warrantyExpiration?: Date;
    createdAt: Date;
}

const commonItems: Record<ItemType, string[]> = {
    "Sim Equipment": ["Launch Monitor", "Projector", "Hitting Mat", "Computer", "Touchscreen", "Camera"],
    "Clubs": ["Driver", "Iron Set", "Wedge", "Putter", "Hybrid", "Fairway Wood"],
    "Balls": ["Golf Balls (Premium)", "Golf Balls (Range)"],
    "Supplies": ["Cleaning Spray", "Microfiber Towels", "Tees", "Gloves"],
    "Misc": []
};

const brandMap: Record<string, Record<string, string[]>> = {
    "Sim Equipment": {
        "Launch Monitor": ["Trackman", "Foresight Sports", "Full Swing", "SkyTrak", "Garmin", "Uneekor"],
        "Projector": ["BenQ", "Optoma", "ViewSonic", "Epson"],
        "Hitting Mat": ["Fiberbuilt", "TrueStrike", "Real Feel"],
    },
    "Clubs": {
        "Driver": ["Titleist", "Callaway", "TaylorMade", "Ping", "Cobra"],
        "Iron Set": ["Titleist", "Callaway", "TaylorMade", "Ping", "Cobra", "Mizuno", "Wilson", "Srixon"],
        "Wedge": ["Titleist", "Callaway", "TaylorMade", "Ping", "Cleveland"],
        "Putter": ["Scotty Cameron", "Odyssey", "Ping", "TaylorMade"],
        "Hybrid": ["Titleist", "Callaway", "TaylorMade", "Ping", "Cobra"],
        "Fairway Wood": ["Titleist", "Callaway", "TaylorMade", "Ping", "Cobra"],
    },
    "Balls": {
        "Golf Balls (Premium)": ["Titleist", "Callaway", "TaylorMade", "Bridgestone", "Srixon"],
        "Golf Balls (Range)": ["Pinnacle", "Top-Flite", "Wilson"],
    },
};

const defaultBrands = [
    "Titleist", "Callaway", "TaylorMade", "Ping", "Cobra", "Mizuno", "Wilson", "Srixon", "Bridgestone",
    "Trackman", "Foresight Sports", "Full Swing", "SkyTrak", "Garmin", "Uneekor",
    "BenQ", "Optoma", "ViewSonic", "Epson",
    "Fiberbuilt", "TrueStrike", "Real Feel",
    "Scotty Cameron", "Odyssey", "Cleveland",
    "Pinnacle", "Top-Flite"
];


const itemFormSchema = z.object({
    id: z.string().optional(),
    type: z.string().min(1, 'Type is required'),
    itemName: z.string().min(1, 'Item Name is required'),
    customItemName: z.string().optional(),
    model: z.string().optional(),
    brand: z.string().optional(),
    customBrand: z.string().optional(),
    serialNumber: z.string().optional(),
    notes: z.string().optional(),
    quantity: z.coerce.number().min(0, 'Quantity cannot be negative'),
    assignedBayId: z.string().optional(),
    status: z.enum(statuses),
    warrantyExpiration: z.string().optional(),
}).refine(data => {
    if (data.itemName === 'Other' && !data.customItemName) {
        return false;
    }
    return true;
}, {
    message: 'Please enter a custom item name',
    path: ['customItemName'],
}).refine(data => {
    if (data.brand === 'Other' && !data.customBrand) {
        return false;
    }
    return true;
}, {
    message: 'Please enter a custom brand name',
    path: ['customBrand'],
});

export type InventoryFormData = z.infer<typeof itemFormSchema>;

interface InventoryTableProps {
    data: InventoryItem[];
    bays: Bay[];
    isItemFormOpen: boolean;
    setItemFormOpen: (isOpen: boolean) => void;
    onSave: (data: InventoryFormData) => void;
    onDelete: (itemId: string) => void;
    onUpdateField: (itemId: string, field: Partial<InventoryItem>) => void;
}

const statusTextMap: Record<ItemStatus, string> = {
    available: 'Available',
    inUse: 'In Use',
    underRepair: 'Under Repair',
    consumed: 'Consumed'
};


function ItemFormFields({ control, bays }: { control: any, bays: Bay[] }) {
    const type = useWatch({ control, name: 'type' }) as ItemType | undefined;
    const itemName = useWatch({ control, name: 'itemName' });
    const brand = useWatch({ control, name: 'brand' });

    const getBrandsForSelection = (): string[] => {
        if (type && itemName && brandMap[type] && brandMap[type][itemName]) {
            return brandMap[type][itemName];
        }
        return defaultBrands;
    };

    const availableBrands = getBrandsForSelection();

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={control} name="type" render={({ field }) => (
                    <FormItem><FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select a type"/></SelectTrigger></FormControl>
                        <SelectContent>
                            {itemTypes.map((cat) => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select><FormMessage /></FormItem>
                )}/>
                 <FormField control={control} name="itemName" render={({ field }) => (
                    <FormItem><FormLabel>Item</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!type}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select an item"/></SelectTrigger></FormControl>
                        <SelectContent>
                            {type && commonItems[type] && commonItems[type].map((item) => (
                                <SelectItem key={item} value={item}>{item}</SelectItem>
                            ))}
                            <SelectItem value="Other">Other...</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage /></FormItem>
                )}/>
            </div>
            
            {itemName === 'Other' && (
                 <FormField control={control} name="customItemName" render={({ field }) => (
                    <FormItem><FormLabel>Custom Item Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={control} name="brand" render={({ field }) => (
                    <FormItem><FormLabel>Brand (Optional)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} defaultValue="">
                            <FormControl><SelectTrigger><SelectValue placeholder="Select a brand" /></SelectTrigger></FormControl>
                            <SelectContent>
                                {availableBrands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                                <SelectItem value="Other">Other...</SelectItem>
                            </SelectContent>
                        </Select>
                    <FormMessage /></FormItem>
                )}/>
                {brand === 'Other' && (
                    <FormField control={control} name="customBrand" render={({ field }) => (
                        <FormItem><FormLabel>Custom Brand</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                )}
            </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={control} name="model" render={({ field }) => (
                    <FormItem><FormLabel>Model (Optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={control} name="serialNumber" render={({ field }) => (
                    <FormItem><FormLabel>Serial Number (Optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={control} name="quantity" render={({ field }) => (
                    <FormItem><FormLabel>Quantity</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={control} name="status" render={({ field }) => (
                    <FormItem><FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                        <SelectContent>
                            {statuses.map(s => <SelectItem key={s} value={s}>{statusTextMap[s]}</SelectItem>)}
                        </SelectContent>
                    </Select><FormMessage /></FormItem>
                )}/>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={control} name="assignedBayId" render={({ field }) => (
                    <FormItem><FormLabel>Assign to Bay (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} defaultValue="">
                        <FormControl><SelectTrigger><SelectValue placeholder="Unassigned"/></SelectTrigger></FormControl>
                        <SelectContent>
                            <SelectItem value="clear-selection">Unassigned</SelectItem>
                            {bays.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                        </SelectContent>
                    </Select><FormMessage /></FormItem>
                )}/>
                
                <FormField control={control} name="warrantyExpiration" render={({ field }) => (
                    <FormItem className="flex flex-col"><FormLabel>Warranty Expiration</FormLabel>
                        <FormControl>
                            <Input type="date" {...field} value={field.value ?? ''} />
                        </FormControl>
                    <FormMessage /></FormItem>
                )}/>
            </div>

            <FormField control={control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notes (Optional)</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
        </>
    )
}

export function InventoryTable({ data, bays, isItemFormOpen, setItemFormOpen, onSave, onDelete, onUpdateField }: InventoryTableProps) {
    const [editingItem, setEditingItem] = React.useState<InventoryItem | null>(null);
    const [deletingItem, setDeletingItem] = React.useState<InventoryItem | null>(null);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

    const form = useForm<InventoryFormData>({ resolver: zodResolver(itemFormSchema) });

    const handleEditClick = (item: InventoryItem) => {
        const isCommonItem = commonItems[item.type as ItemType]?.includes(item.itemName);

        const getBrandsForSelection = (): string[] => {
            if (item.type && item.itemName && brandMap[item.type] && brandMap[item.type][item.itemName]) {
                return brandMap[item.type][item.itemName];
            }
            return defaultBrands;
        };
        const availableBrands = getBrandsForSelection();
        const isCommonBrand = item.brand && availableBrands.includes(item.brand);

        form.reset({
            id: item.id,
            type: item.type,
            model: item.model || '',
            brand: isCommonBrand ? item.brand || '' : 'Other',
            customBrand: isCommonBrand ? '' : item.brand || '',
            serialNumber: item.serialNumber || '',
            notes: item.notes || '',
            itemName: isCommonItem ? item.itemName : 'Other',
            customItemName: isCommonItem ? '' : item.itemName,
            assignedBayId: item.assignedBayId || '',
            quantity: item.quantity,
            status: item.status,
            warrantyExpiration: item.warrantyExpiration ? format(item.warrantyExpiration, 'yyyy-MM-dd') : '',
        });
        setEditingItem(item);
        setItemFormOpen(true);
    };
    
    const handleAddNewClick = () => {
        setEditingItem(null);
        form.reset({
            id: undefined,
            type: 'Misc',
            itemName: '',
            customItemName: '',
            model: '',
            brand: '',
            customBrand: '',
            serialNumber: '',
            notes: '',
            quantity: 1,
            assignedBayId: '',
            status: 'available',
            warrantyExpiration: '',
        });
        setItemFormOpen(true);
    };

    const closeDialog = () => {
        setItemFormOpen(false);
        setEditingItem(null);
    }

    const handleSave = (formData: InventoryFormData) => {
        const submissionData = {
            ...formData,
            itemName: formData.itemName === 'Other' ? formData.customItemName! : formData.itemName,
            brand: formData.brand === 'Other' ? formData.customBrand : formData.brand,
        };
        onSave(submissionData);
        closeDialog();
    };
    
    const getStatusVariant = (status: ItemStatus) => {
        switch (status) {
            case 'available': return 'default';
            case 'inUse': return 'secondary';
            case 'underRepair': return 'destructive';
            case 'consumed': return 'outline';
            default: return 'outline';
        }
    };
    
    const columns: ColumnDef<InventoryItem>[] = [
        { accessorKey: 'type', header: 'Type' },
        { accessorKey: 'itemName', header: 'Item' },
        { accessorKey: 'brand', header: 'Brand' },
        { accessorKey: 'model', header: 'Model' },
        { accessorKey: 'serialNumber', header: 'Serial Number' },
        { 
            accessorKey: 'quantity', 
            header: 'Quantity',
            cell: ({ row }) => {
                const item = row.original;
                return (
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onUpdateField(item.id, { quantity: item.quantity - 1 })} disabled={item.quantity <= 0}>
                            <Minus className="h-4 w-4" />
                        </Button>
                        <span>{item.quantity}</span>
                         <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onUpdateField(item.id, { quantity: item.quantity + 1 })}>
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                )
            }
        },
        { 
            accessorKey: 'assignedBayId', 
            header: 'Assigned Bay',
            cell: ({ row }) => {
                const item = row.original;
                return (
                     <Select 
                        value={item.assignedBayId || ''} 
                        onValueChange={(value) => onUpdateField(item.id, { assignedBayId: value === 'clear-selection' ? '' : value })}
                     >
                        <SelectTrigger className="w-32">
                            <SelectValue placeholder="Unassigned"/>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="clear-selection">Unassigned</SelectItem>
                            {bays.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                )
            }
        },
        { 
            accessorKey: 'status', 
            header: 'Status',
            cell: ({ row }) => {
                const status = row.original.status;
                return <Badge variant={getStatusVariant(status)}>{statusTextMap[status]}</Badge>;
            }
        },
        { 
            accessorKey: 'warrantyExpiration', 
            header: 'Warranty Ends',
            cell: ({ row }) => row.original.warrantyExpiration ? format(row.original.warrantyExpiration, 'P') : 'N/A'
        },
        {
          id: 'actions',
          cell: ({ row }) => {
            const item = row.original;
            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => handleEditClick(item)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Item
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => setDeletingItem(item)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            );
          },
        },
      ];

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onColumnFiltersChange: setColumnFilters,
        getFilteredRowModel: getFilteredRowModel(),
        state: { columnFilters },
        initialState: { pagination: { pageSize: 50 } },
    });
    
    return (
        <div>
            <div className="flex items-center py-4 gap-2">
                <Input
                    placeholder="Filter by item or brand..."
                    value={(table.getColumn("itemName")?.getFilterValue() as string) ?? ""}
                    onChange={(event) => {
                        table.getColumn("itemName")?.setFilterValue(event.target.value);
                    }}
                    className="max-w-sm"
                />
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline"><Filter className="mr-2 h-4 w-4" />Filters</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuLabel>Filter by Type</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {itemTypes.map((cat) => (
                            <DropdownMenuItem key={cat} onClick={() => table.getColumn("type")?.setFilterValue(cat)}>{cat}</DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {statuses.map(stat => (
                             <DropdownMenuItem key={stat} onClick={() => table.getColumn("status")?.setFilterValue(stat)}>{statusTextMap[stat]}</DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                         <DropdownMenuLabel>Filter by Bay</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => table.getColumn("assignedBayId")?.setFilterValue(undefined)}>Unassigned</DropdownMenuItem>
                        {bays.map(bay => (
                             <DropdownMenuItem key={bay.id} onClick={() => table.getColumn("assignedBayId")?.setFilterValue(bay.id)}>{bay.name}</DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => table.resetColumnFilters()}>Clear Filters</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <div className="rounded-md border">
                <Table>
                <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                        <TableHead key={header.id}>
                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                        ))}
                    </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                        <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                        ))}
                        </TableRow>
                    ))
                    ) : (
                    <TableRow>
                        <TableCell colSpan={columns.length} className="h-24 text-center">
                        No inventory items found.
                        </TableCell>
                    </TableRow>
                    )}
                </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-end space-x-2 py-4">
                <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Previous</Button>
                <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next</Button>
            </div>

            <Dialog open={isItemFormOpen} onOpenChange={(isOpen) => {
                if (!isOpen) {
                    closeDialog();
                } else {
                    if (!editingItem) {
                        handleAddNewClick();
                    }
                }
            }}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
                        <DialogDescription>Fill out the details for the inventory item.</DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4 max-h-[70vh] overflow-y-auto p-4">
                           <ItemFormFields control={form.control} bays={bays} />
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={closeDialog}>Cancel</Button>
                                <Button type="submit">Save Item</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={deletingItem !== null} onOpenChange={(isOpen) => !isOpen && setDeletingItem(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the item: <span className="font-bold">{deletingItem?.itemName}</span>. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeletingItem(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { if(deletingItem) { onDelete(deletingItem.id); setDeletingItem(null); } }} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
