"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/upload", label: "Upload" },
  { href: "/chat", label: "Chat" },
  { href: "/contradictions", label: "Contradictions" },
  { href: "/documents", label: "Library" },
];

export function NavBar() {
  const pathname = usePathname();
  return (
    <header className="border-b border-border">
      <div className="container flex h-14 items-center justify-between">
        <Link href="/upload" className="font-heading text-base font-semibold tracking-tight">
          Document Intelligence
        </Link>
        <nav className="flex items-center gap-6">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm text-muted-foreground transition-colors hover:text-foreground",
                pathname?.startsWith(link.href) && "text-foreground font-medium"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
