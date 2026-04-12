"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardCardSkeleton() {
  return (
    <Card className="border-2 shadow-neo-sm">
      <CardContent className="p-5">
        <Skeleton className="mb-4 h-7 w-3/5" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="mb-4 space-y-1">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-2/5" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function CourseCardSkeleton() {
  return (
    <Card className="overflow-hidden border-2 shadow-neo-sm">
      <Skeleton className="h-24 w-full rounded-none" />
      <CardContent className="p-5">
        <Skeleton className="mb-2 h-6 w-[70px] rounded-sm" />
        <Skeleton className="mb-1 h-7 w-4/5" />
        <Skeleton className="mb-4 h-4 w-1/2" />
        <Skeleton className="mb-4 h-14 rounded-xl" />
        <Skeleton className="h-10 rounded-xl" />
      </CardContent>
    </Card>
  );
}
