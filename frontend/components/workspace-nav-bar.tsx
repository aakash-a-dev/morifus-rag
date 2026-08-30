"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function WorkspaceNavBar({ name, slug }: { name: string; slug: string }) {
  const pathname = usePathname();
  const links = [
    { href: `/w/${slug}/upload`, label: "Upload" },
    { href: `/w/${slug}/chat`, label: "Chat" },
    { href: `/w/${slug}/contradictions`, label: "Contradictions" },
    { href: `/w/${slug}/documents`, label: "Library" },
  ];

  return (
    <header className="border-b border-border">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" className="shrink-0 text-sm text-muted-foreground hover:text-foreground">
            ← Workspaces
          </Link>
          <span className="text-border">/</span>
          <span className="truncate font-heading text-base font-semibold tracking-tight">{name}</span>
        </div>
        <nav className="flex items-center gap-6">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm text-muted-foreground transition-colors hover:text-foreground",
                pathname === link.href && "text-foreground font-medium"
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
