
'use client';

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  useReactTable,
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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, Trash2, Edit, KeyRound } from 'lucide-react';
import { format } from 'date-fns';
import { Timestamp } from 'firebase/firestore';


export interface Staff {
  id: string;
  fullName: string;
  email: string;
  role: 'owner' | 'admin' | 'trainer' | 'maintenance' | 'frontDesk';
  status: 'active' | 'inactive';
  lastLogin: Date;
  createdByOwner: boolean;
  facilityId: string;
}

const roleMap: Record<Staff['role'], string> = {
    owner: 'Owner',
    admin: 'Admin',
    trainer: 'Trainer',
    maintenance: 'Maintenance',
    frontDesk: 'Front Desk',
}

// For editing existing staff
const staffFormSchema = z.object({
  id: z.string(),
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'trainer', 'maintenance', 'frontDesk', 'owner']),
  status: z.enum(['active', 'inactive']),
});
export type StaffFormData = z.infer<typeof staffFormSchema>;

// For adding (inviting) new staff
const addStaffFormSchema = z.object({
    fullName: z.string().min(1, 'Full name is required'),
    email: z.string().email('Invalid email address'),
    role: z.enum(['admin', 'trainer', 'maintenance', 'frontDesk']),
});
export type AddStaffFormData = z.infer<typeof addStaffFormSchema>;


interface StaffTableProps {
    data: Staff[];
    isAddStaffOpen: boolean;
    setAddStaffOpen: (isOpen: boolean) => void;
    onSave: (data: StaffFormData) => void;
    onDelete: (staffId: string) => void;
    onResetPassword: (staffId: string) => void;
    onInvite: (data: AddStaffFormData) => void;
    currentUserRole?: Staff['role'] | null;
}

export function StaffTable({ data, isAddStaffOpen, setAddStaffOpen, onSave, onDelete, onResetPassword, onInvite, currentUserRole }: StaffTableProps) {
  const [editingStaff, setEditingStaff] = React.useState<Staff | null>(null);
  const [deletingStaff, setDeletingStaff] = React.useState<Staff | null>(null);
  const [resettingStaff, setResettingStaff] = React.useState<Staff | null>(null);

  const editForm = useForm<StaffFormData>({ resolver: zodResolver(staffFormSchema) });
  const addForm = useForm<AddStaffFormData>({ 
    resolver: zodResolver(addStaffFormSchema),
    defaultValues: { role: 'frontDesk', fullName: '', email: '' },
  });
  
  React.useEffect(() => {
      if (editingStaff) {
        editForm.reset({
            id: editingStaff.id,
            fullName: editingStaff.fullName,
            email: editingStaff.email,
            role: editingStaff.role,
            status: editingStaff.status,
        });
      }
  }, [editingStaff, editForm]);

  const closeDialog = () => {
    setAddStaffOpen(false);
    setEditingStaff(null);
    addForm.reset();
  }

  const handleSave = (formData: StaffFormData) => {
    onSave(formData);
    setEditingStaff(null);
  };
  
  const handleInvite = (formData: AddStaffFormData) => {
    onInvite(formData);
    // Let parent component handle dialog close on success
  }

  const handleDelete = () => {
    if (deletingStaff) {
        onDelete(deletingStaff.id);
        setDeletingStaff(null);
    }
  }

  const handleResetPasswordConfirm = () => {
    if (resettingStaff) {
        onResetPassword(resettingStaff.id);
        setResettingStaff(null);
    }
  }
  
  const columns: ColumnDef<Staff>[] = [
    { accessorKey: 'fullName', header: 'Name' },
    { accessorKey: 'email', header: 'Email' },
    { 
        accessorKey: 'role', 
        header: 'Role',
        cell: ({ row }) => roleMap[row.original.role]
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.getValue('status') === 'active' ? 'default' : 'secondary'}>
          {row.getValue('status') === 'active' ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      accessorKey: 'lastLogin',
      header: 'Last Login',
      cell: ({ row }) => {
        const staff = row.original;
        if (staff.role === 'owner') return 'N/A';
        
        const lastLogin = row.getValue('lastLogin') as Date | Timestamp;
        if (!lastLogin || (lastLogin instanceof Date && lastLogin.getTime() === 0)) return 'Never';
        const date = lastLogin instanceof Timestamp ? lastLogin.toDate() : lastLogin;
        return format(date, 'P p')
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const staff = row.original;
        const canManage = currentUserRole === 'owner' || (currentUserRole === 'admin' && staff.role !== 'owner');

        if (staff.role === 'owner') return <span className="text-muted-foreground text-sm font-semibold">Owner</span>;
        if (!currentUserRole || !canManage) return null;
        
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
                <DropdownMenuItem onSelect={() => setEditingStaff(staff)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Details
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setResettingStaff(staff)}>
                    <KeyRound className="mr-2 h-4 w-4" />
                    Send Password Reset
                </DropdownMenuItem>
                 <DropdownMenuSeparator />
                <DropdownMenuItem
                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                    onSelect={() => setDeletingStaff(staff)}
                >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove Staff
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
                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
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
                  No results.
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
      
       <Dialog open={isAddStaffOpen || editingStaff !== null} onOpenChange={(isOpen) => {
            if(!isOpen) {
                setAddStaffOpen(false);
                setEditingStaff(null);
            }
       }}>
            {editingStaff ? (
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Staff Member</DialogTitle>
                        <DialogDescription>Update details for {editingStaff.fullName}</DialogDescription>
                    </DialogHeader>
                    <Form {...editForm}>
                        <form onSubmit={editForm.handleSubmit(handleSave)} className="space-y-4">
                            {/* Form fields for editing */}
                            <FormField control={editForm.control} name="fullName" render={({ field }) => (
                                <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={editForm.control} name="email" render={({ field }) => (
                                <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} disabled /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={editForm.control} name="role" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Role</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value} disabled={editingStaff?.role === 'owner'}>
                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {Object.entries(roleMap).map(([key, value]) => (
                                                <SelectItem key={key} value={key as Staff['role']} disabled={key === 'owner'}>
                                                    {value}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                                )}/>
                                <FormField control={editForm.control} name="status" render={({ field }) => (
                                    <FormItem><FormLabel>Status</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="active">Active</SelectItem>
                                                <SelectItem value="inactive">Inactive</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )}/>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => setEditingStaff(null)}>Cancel</Button>
                                <Button type="submit">Save Changes</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            ) : (
                 <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Invite New Staff Member</DialogTitle>
                        <DialogDescription>
                            An invitation will be sent to their email to create an account and set a password.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...addForm}>
                        <form onSubmit={addForm.handleSubmit(handleInvite)} className="space-y-4">
                             <FormField control={addForm.control} name="fullName" render={({ field }) => (
                                <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                             <FormField control={addForm.control} name="email" render={({ field }) => (
                                <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                             <FormField control={addForm.control} name="role" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Role</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                             {Object.entries(roleMap).filter(([key]) => key !== 'owner').map(([key, value]) => (
                                                <SelectItem key={key} value={key as Staff['role']}>{value}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}/>
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={closeDialog}>Cancel</Button>
                                <Button type="submit">Send Invitation</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            )}
       </Dialog>
      
      <AlertDialog open={deletingStaff !== null} onOpenChange={(isOpen) => !isOpen && setDeletingStaff(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will permanently remove <span className="font-bold">{deletingStaff?.fullName}</span> from your staff and revoke their access. This action cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeletingStaff(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Remove Staff</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resettingStaff !== null} onOpenChange={(isOpen) => !isOpen && setResettingStaff(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Confirm Password Reset</AlertDialogTitle>
                <AlertDialogDescription>
                    Are you sure you want to send a password reset email to <span className="font-bold">{resettingStaff?.fullName}</span> at <span className="font-mono">{resettingStaff?.email}</span>?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setResettingStaff(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetPasswordConfirm}>Send Email</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

    