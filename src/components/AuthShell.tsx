import type { ReactNode } from "react";
import { Calculator } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-navy via-brand to-brand-teal px-4 py-12">
      <Card className="w-full max-w-md border-0 shadow-2xl">
        <CardHeader className="space-y-2">
          <span className="flex size-10 items-center justify-center rounded-lg bg-brand text-brand-foreground">
            <Calculator className="size-5" />
          </span>
          <CardTitle className="font-brand text-2xl tracking-tight">{title}</CardTitle>
          <CardDescription>{subtitle}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}
