
import Link from "next/link";
import { Users } from 'lucide-react';

export function Logo() {
  return (
    <Link
      href="/"
      className="group flex items-center justify-center gap-2 rounded-full text-lg font-semibold"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Users className="h-4 w-4 transition-all group-hover:scale-110" />
      </div>
      <span className="ml-2 text-lg font-bold">TeeBoxed</span>
    </Link>
  );
}
