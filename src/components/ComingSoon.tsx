"use client";

import { Construction } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Card className="max-w-sm border-2 text-center">
        <CardContent className="p-8">
          <Construction className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="mb-1 text-lg font-bold">{title}</h2>
          <p className="text-sm text-muted-foreground">This feature is coming soon. Stay tuned!</p>
        </CardContent>
      </Card>
    </div>
  );
}
