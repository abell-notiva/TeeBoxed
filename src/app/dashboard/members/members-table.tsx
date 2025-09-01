
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
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, FileText, Trash2, Edit, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { Booking } from '../bookings/booking-calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';


// Define the shape of a Member
export interface Member {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  membershipType: string;
  status: 'active' | 'inactive';
  joinDate: Date;
  membershipExpiry: Date;
}

const createMemberFormSchema = (planNames: string[]) => {
    const allPlans = ['Non-Member', ...planNames];
    return z.object({
        id: z.string().optional(),
        fullName: z.string().min(1, 'Full name is required'),
        email: z.string().email('Invalid email address'),
        phone: z.string().optional(),
        membershipType: z.string().refine(value => allPlans.includes(value), {
            message: "Invalid membership type selected",
        }),
        status: z.enum(['active', 'inactive']),
        membershipExpiry: z.date({
            required_error: "Membership expiry date is required.",
        }),
    });
};

type MemberFormData = z.infer<ReturnType<typeof createMemberFormSchema>>;

interface MembersTableProps {
    data: Member[];
    bookings?: Booking[];
    isAddMemberOpen: boolean;
    setAddMemberOpen: (isOpen: boolean) => void;
    onSave: (data: MemberFormData) => void;
    onDelete: (memberId: string) => void;
    membershipPlans: string[];
}

export function MembersTable({ data, bookings = [], isAddMemberOpen, setAddMemberOpen, onSave, onDelete, membershipPlans }: MembersTableProps) {
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [editingMember, setEditingMember] = React.useState<Member | null>(null);
  const [deletingMember, setDeletingMember] = React.useState<Member | null>(null);
  const [viewingMember, setViewingMember] = React.useState<Member | null>(null);
  const [bookingHistory, setBookingHistory] = React.useState<Booking[]>([]);

  const MemberFormSchema = React.useMemo(() => createMemberFormSchema(membershipPlans), [membershipPlans]);

  const form = useForm<MemberFormData>({
    resolver: zodResolver(MemberFormSchema),
    defaultValues: { 
        fullName: '', 
        email: '', 
        phone: '', 
        membershipType: 'Non-Member', 
        status: 'active',
        membershipExpiry: new Date(),
    },
  });

  React.useEffect(() => {
    if (isAddMemberOpen && !editingMember) {
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
      form.reset({ 
          fullName: '', 
          email: '', 
          phone: '', 
          membershipType: membershipPlans.length > 0 ? membershipPlans[0] : 'Non-Member', 
          status: 'active', 
          id: undefined, 
          membershipExpiry: oneYearFromNow
      });
    }
  }, [isAddMemberOpen, editingMember, form, membershipPlans]);

  React.useEffect(() => {
      if (editingMember) {
        form.reset({
            id: editingMember.id,
            fullName: editingMember.fullName,
            email: editingMember.email,
            phone: editingMember.phone,
            membershipType: editingMember.membershipType,
            status: editingMember.status,
            membershipExpiry: editingMember.membershipExpiry,
        });
        setAddMemberOpen(true);
      }
  }, [editingMember, form, setAddMemberOpen]);
  
  React.useEffect(() => {
    if (viewingMember) {
        const memberBookings = bookings.filter(b => b.memberId === viewingMember.id);
        setBookingHistory(memberBookings);
    } else {
        setBookingHistory([]);
    }
  }, [viewingMember, bookings]);


  const handleSave = async (formData: MemberFormData) => {
    try {
      await onSave(formData);
      setAddMemberOpen(false);
      setEditingMember(null);
      form.reset();
    } catch (error) {
      console.error('Error saving member:', error);
      // Keep dialog open to show error
    }
  };

  const handleDelete = () => {
    if (deletingMember) {
      onDelete(deletingMember.id);
      setDeletingMember(null);
    }
  };
  
  const columns: ColumnDef<Member>[] = [
    { accessorKey: 'fullName', header: 'Name' },
    { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'membershipType', header: 'Membership' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.getValue('status') as string;
        return (
          <Badge variant={status === 'active' ? 'default' : 'secondary'}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'joinDate',
      header: 'Join Date',
      cell: ({ row }) => {
        const date = row.getValue('joinDate');
        return date ? format(new Date(date as string), 'P') : 'N/A';
      },
    },
    {
        accessorKey: 'membershipExpiry',
        header: 'Expiry Date',
        cell: ({ row }) => {
            const date = row.original.membershipExpiry;
            return date ? format(date, 'P') : 'N/A';
        },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const member = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => setViewingMember(member)}>
                <FileText className="mr-2 h-4 w-4" />
                View History
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setEditingMember(member)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                onSelect={() => setDeletingMember(member)}
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
    getPaginationRowModel: getPaginationRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      columnFilters,
    },
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
                <TableRow 
                    key={row.id} 
                    onClick={() => setViewingMember(row.original)}
                    className="cursor-pointer"
                    data-state={row.getIsSelected() && 'selected'}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} onClick={(e) => {
                      if ((e.target as HTMLElement).closest('[data-radix-dropdown-menu-trigger]')) {
                        e.stopPropagation();
                      }
                    }}>
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
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
      
      {/* Add/Edit Member Dialog */}
      <Dialog open={isAddMemberOpen} onOpenChange={(isOpen) => {
        if (!isOpen) {
            setAddMemberOpen(false);
            setEditingMember(null);
        } else {
            setAddMemberOpen(true);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMember ? 'Edit Member' : 'Add New Member'}</DialogTitle>
            <DialogDescription>
              {editingMember ? 'Update the details for this member.' : 'Enter the details for the new member.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
              <FormField control={form.control} name="fullName" render={({ field }) => (
                <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>Phone (Optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="membershipType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Membership</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select membership type" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Non-Member">Non-Member</SelectItem>
                        {membershipPlans.map(planName => (
                            <SelectItem key={planName} value={planName}>{planName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}/>
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}/>
              </div>
               <FormField control={form.control} name="membershipExpiry" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Membership Expiry</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date < new Date("1900-01-01")
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}/>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => { setAddMemberOpen(false); setEditingMember(null); }}>Cancel</Button>
                <Button type="submit">Save Member</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deletingMember !== null} onOpenChange={(isOpen) => !isOpen && setDeletingMember(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will permanently delete the member <span className="font-bold">{deletingMember?.fullName}</span>. This action cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeletingMember(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Booking History Sheet */}
        <Sheet open={viewingMember !== null} onOpenChange={(isOpen) => !isOpen && setViewingMember(null)}>
            <SheetContent className="sm:max-w-[600px]">
                <SheetHeader>
                    <SheetTitle>Booking History: {viewingMember?.fullName}</SheetTitle>
                    <SheetDescription>Showing recent bookings for this member.</SheetDescription>
                </SheetHeader>
                <div className="mt-4">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Bay</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {bookingHistory.length > 0 ? bookingHistory.map(booking => (
                                <TableRow key={booking.id}>
                                    <TableCell>{booking.bayName}</TableCell>
                                    <TableCell>{format(booking.startTime, 'P p')}</TableCell>
                                    <TableCell>
                                        <Badge variant={booking.status === 'confirmed' ? 'default' : 'secondary'}>{booking.status}</Badge>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center h-24">No booking history found.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </SheetContent>
        </Sheet>
    </div>
  );
}
