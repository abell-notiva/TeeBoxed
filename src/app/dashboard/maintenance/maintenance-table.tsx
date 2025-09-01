
'use client';

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, Trash2, Edit, Wrench, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Bay } from '../bookings/bay-status';
import { Staff } from '../staff/staff-table';
import { InventoryItem } from '../inventory/inventory-table';


export interface MaintenanceTask {
    id: string;
    bayId: string;
    bayName: string;
    title: string;
    description: string;
    status: 'open' | 'inProgress' | 'resolved';
    priority: 'low' | 'medium' | 'high';
    assignedTo: string;
    assignedStaffName: string;
    inventoryItemId?: string;
    inventoryItemName?: string;
    createdAt: Date;
    resolvedAt?: Date;
}

const taskFormSchema = z.object({
    id: z.string().optional(),
    bayId: z.string().min(1, 'A bay must be selected'),
    title: z.string().min(3, 'Title is required'),
    description: z.string().optional(),
    assignedTo: z.string().optional(),
    status: z.enum(['open', 'inProgress', 'resolved']).optional(),
    priority: z.enum(['low', 'medium', 'high']),
    inventoryItemId: z.string().optional(),
});

export type MaintenanceTaskFormData = z.infer<typeof taskFormSchema>;


interface MaintenanceTableProps {
    data: MaintenanceTask[];
    staff: Staff[];
    bays: Bay[];
    inventory: InventoryItem[];
    isTaskFormOpen: boolean;
    setTaskFormOpen: (isOpen: boolean) => void;
    onSave: (data: MaintenanceTaskFormData) => void;
    onDelete: (taskId: string) => void;
    onResolve: (task: MaintenanceTask) => void;
}

export function MaintenanceTable({ data, staff, bays, inventory, isTaskFormOpen, setTaskFormOpen, onSave, onDelete, onResolve }: MaintenanceTableProps) {
  const [editingTask, setEditingTask] = React.useState<MaintenanceTask | null>(null);
  const [deletingTask, setDeletingTask] = React.useState<MaintenanceTask | null>(null);

  const form = useForm<MaintenanceTaskFormData>({
    resolver: zodResolver(taskFormSchema),
  });
  
  React.useEffect(() => {
    if (editingTask) {
      form.reset({
          id: editingTask.id,
          bayId: editingTask.bayId,
          title: editingTask.title,
          description: editingTask.description,
          assignedTo: editingTask.assignedTo,
          status: editingTask.status,
          priority: editingTask.priority,
          inventoryItemId: editingTask.inventoryItemId,
      });
    } else {
       form.reset({
          id: undefined,
          bayId: '',
          title: '',
          description: '',
          assignedTo: '',
          status: 'open',
          priority: 'medium',
          inventoryItemId: '',
       });
    }
  }, [editingTask, form, isTaskFormOpen]);


  const closeDialog = () => {
    setTaskFormOpen(false);
    setEditingTask(null);
  }
  
  const handleSave = (formData: MaintenanceTaskFormData) => {
    onSave(formData);
    closeDialog();
  };
  
  const getStatusVariant = (status: MaintenanceTask['status']) => {
    switch (status) {
        case 'open': return 'destructive';
        case 'inProgress': return 'secondary';
        case 'resolved': return 'default';
        default: return 'outline';
    }
  }

  const getPriorityVariant = (priority: MaintenanceTask['priority']) => {
    switch (priority) {
        case 'low': return 'secondary';
        case 'medium': return 'default';
        case 'high': return 'destructive';
        default: return 'outline';
    }
  }


  const columns: ColumnDef<MaintenanceTask>[] = [
    { accessorKey: 'bayName', header: 'Bay' },
    { accessorKey: 'title', header: 'Issue' },
    { accessorKey: 'inventoryItemName', header: 'Item', cell: ({ row }) => row.original.inventoryItemName || 'N/A' },
    {
      accessorKey: 'priority',
      header: 'Priority',
      cell: ({ row }) => {
        const priority = row.original.priority;
        return <Badge variant={getPriorityVariant(priority)} className="capitalize">{priority}</Badge>;
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <Badge variant={getStatusVariant(status)} className="capitalize">
            {status === 'inProgress' ? 'In Progress' : status}
          </Badge>
        );
      },
    },
    { accessorKey: 'assignedStaffName', header: 'Assigned To' },
    {
      accessorKey: 'createdAt',
      header: 'Created Date',
      cell: ({ row }) => format(row.original.createdAt, 'P'),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const task = row.original;
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
               {task.status !== 'resolved' && (
                  <DropdownMenuItem onClick={() => onResolve(task)}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Mark Resolved
                  </DropdownMenuItem>
               )}
              <DropdownMenuItem onClick={() => { setEditingTask(task); setTaskFormOpen(true); }}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Task
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setDeletingTask(task)}
              >
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
  });

  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
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
                  No maintenance tasks found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      {/* Add/Edit Task Dialog */}
      <Dialog open={isTaskFormOpen} onOpenChange={(isOpen) => {
        if(!isOpen) {
            closeDialog();
        } else {
            setTaskFormOpen(true);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Edit Maintenance Task' : 'Create New Maintenance Task'}</DialogTitle>
            <DialogDescription>
              {editingTask ? 'Update the details for this maintenance task.' : 'Log a new maintenance issue.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem><FormLabel>Issue Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
               <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="bayId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bay</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select a bay" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {bays.map(bay => (
                                <SelectItem key={bay.id} value={bay.id}>{bay.name}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}/>
                  <FormField control={form.control} name="inventoryItemId" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Related Item (Optional)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} defaultValue="">
                            <FormControl><SelectTrigger><SelectValue placeholder="Select an item"/></SelectTrigger></FormControl>
                            <SelectContent>
                                {inventory.map(item => <SelectItem key={item.id} value={item.id}>{item.itemName} {item.brand ? `(${item.brand})` : ''}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </FormItem>
                )}/>
               </div>
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description (Optional)</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <div className="grid grid-cols-2 gap-4">
                 <FormField control={form.control} name="assignedTo" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Assign To</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} defaultValue="">
                            <FormControl><SelectTrigger><SelectValue placeholder="Unassigned"/></SelectTrigger></FormControl>
                            <SelectContent>
                                {staff.map(s => <SelectItem key={s.id} value={s.id}>{s.fullName}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </FormItem>
                )}/>
                <FormField control={form.control} name="priority" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                            </SelectContent>
                        </Select>
                    </FormItem>
                )}/>
              </div>
                {editingTask && (
                     <FormField control={form.control} name="status" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="open">Open</SelectItem>
                                    <SelectItem value="inProgress">In Progress</SelectItem>
                                    <SelectItem value="resolved">Resolved</SelectItem>
                                </SelectContent>
                            </Select>
                        </FormItem>
                    )}/>
                )}
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={closeDialog}>Cancel</Button>
                <Button type="submit">Save Task</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deletingTask !== null} onOpenChange={(isOpen) => !isOpen && setDeletingTask(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will permanently delete the task: <span className="font-bold">{deletingTask?.title}</span>. This action cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeletingTask(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => { if(deletingTask) { onDelete(deletingTask.id); setDeletingTask(null); } }} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

    