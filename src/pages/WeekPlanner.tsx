import { useState, useMemo, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { 
  Calendar,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle
} from "lucide-react";
import { db } from "@/lib/db";
import { 
  generateTimeBlocks, 
  getTodayBlocks, 
  formatBlockTime,
  TimeBlock 
} from "@/lib/scheduleEngine";
import { useMorningBriefing } from "@/hooks/useMorningBriefing";
import { useGamification } from "@/contexts/GamificationContext";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedCardList, AnimatedCard } from "@/components/AnimatedCardList";

// ── Colors mapped to priority ────────────────────────────────────────────────

const PRIORITY_COLORS = {
  critical: "border-destructive bg-destructive/10 text-destructive",
  high: "border-orange-500 bg-orange-500/10 text-orange-700 dark:text-orange-400",
  medium: "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  low: "border-primary bg-primary/10 text-primary"
};

// ── Morning Anchor Card ──────────────────────────────────────────────────────

function MorningBriefingCard({ blocks }: { blocks: TimeBlock[] }) {
  const { briefing, isLoading, error, provider, retry } = useMorningBriefing(blocks);

  return (
    <Card className="border-2 border-primary/20 shadow-neo-sm overflow-hidden mb-6 relative">
      {/* Decorative gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      
      <CardContent className="p-6 relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-primary font-bold">
            <Sparkles className="h-5 w-5 text-accent" />
            <h3>Morning Briefing</h3>
          </div>
          {provider && (
            <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-wider border-primary/20">
              {provider === "groq" ? "Online AI" : "Local AI"}
            </Badge>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2 pb-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[90%]" />
            <Skeleton className="h-4 w-[95%]" />
            <Skeleton className="h-4 w-[70%]" />
          </div>
        ) : error && !briefing ? (
          <div className="flex flex-col items-center justify-center p-4 text-center">
            <AlertCircle className="h-8 w-8 text-destructive mb-2 opacity-80" />
            <p className="text-sm text-muted-foreground mb-3">{error}</p>
            <Button variant="outline" size="sm" onClick={retry} className="border-2">
              <RefreshCw className="h-3 w-3 mr-2" />
              Try Again
            </Button>
          </div>
        ) : (
          <div className="text-foreground/90 leading-relaxed font-medium">
            {briefing}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function WeekPlanner() {
  const { userId, isLoaded } = useGamification();
  const [computing, setComputing] = useState(false);

  // 1. Fetch raw data from Dexie
  const assignments = useLiveQuery(
    () => userId ? db.assignments.where("userId").equals(userId).toArray() : [],
    [userId]
  );
  
  const schedules = useLiveQuery(
    () => userId ? db.schedules.where("userId").equals(userId).toArray() : [],
    [userId]
  );

  const courses = useLiveQuery(
    () => userId ? db.courses.where("userId").equals(userId).toArray() : [],
    [userId]
  );

  // Map courses for easy lookup
  const courseMap = useMemo(() => {
    return new Map((courses || []).map(c => [c.id, c]));
  }, [courses]);

  // 2. Generate Deterministic Blocks
  const allBlocks = useMemo(() => {
    if (!assignments) return [];
    
    // Set of IDs already marked as complete in Dexie
    const completedSet = new Set(
      (schedules || []).filter(s => s.completed).map(s => s.id)
    );

    setComputing(true);
    // Algorithm run
    const blocks = generateTimeBlocks(assignments, completedSet);
    
    // Simulate slight delay so UI doesn't flicker instantly on live-query updates
    setTimeout(() => setComputing(false), 300);
    return blocks;
  }, [assignments, schedules]);

  // 3. Filter for Today
  const todayBlocks = useMemo(() => getTodayBlocks(allBlocks), [allBlocks]);
  const upcomingBlocks = useMemo(() => allBlocks.filter(b => !todayBlocks.includes(b)), [allBlocks, todayBlocks]);

  // 4. Handlers
  const toggleComplete = async (block: TimeBlock) => {
    if (!userId) return;
    
    const newVal = !block.completed;
    
    try {
      const existing = await db.schedules.get(block.id);
      if (existing) {
        await db.schedules.update(block.id, { completed: newVal, updatedAt: Date.now() });
      } else {
        await db.schedules.put({
          ...block,
          userId,
          completed: newVal,
          updatedAt: Date.now()
        });
      }
    } catch (err) {
      console.error("Failed to update schedule block:", err);
    }
  };

  const loading = !isLoaded || assignments === undefined || computing;

  // ── Render Helpers ────────────────────────────────────────────────────────

  const renderBlock = (b: TimeBlock, index: number) => {
    const course = courseMap.get(b.courseId);
    const colorClass = PRIORITY_COLORS[b.priority] || PRIORITY_COLORS.medium;
    
    return (
      <AnimatedCard key={b.id}>
        <div className={cn(
          "flex gap-4 p-4 rounded-xl border-2 transition-all mb-3 relative overflow-hidden",
          b.completed ? "bg-muted border-muted-foreground/20 opacity-70" : "bg-card border-border shadow-neo-sm hover:-translate-y-0.5 hover:shadow-neo",
        )}>
          {/* Left accent line representing priority */}
          {!b.completed && (
            <div className={cn("absolute left-0 top-0 bottom-0 w-1.5 opacity-50", colorClass.split(" ")[1])} />
          )}

          {/* Time & Due Info */}
          <div className="w-24 shrink-0 flex flex-col items-start gap-1">
            <Badge variant="outline" className={cn(
              "font-mono text-[11px] whitespace-nowrap px-1.5 border-2 rounded-md",
              !b.completed ? "border-primary/50 text-foreground" : "border-muted-foreground/30 text-muted-foreground"
            )}>
              <Clock className="w-3 h-3 mr-1 inline" />
              {formatBlockTime(b)}
            </Badge>
            {b.priority === "critical" && !b.completed && (
              <span className="text-[10px] font-bold text-destructive uppercase tracking-widest pl-1 mt-1">
                Due Soon
              </span>
            )}
          </div>

          {/* Core Content */}
          <div className="flex-1 min-w-0 pr-4">
            <h4 className={cn(
              "font-bold text-sm mb-1 truncate transition-colors",
              b.completed && "line-through text-muted-foreground"
            )}>
              {b.assignmentName}
            </h4>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cn(
                "h-5 text-[10px] border-0",
                b.completed ? "bg-muted-foreground/20 text-muted-foreground" : colorClass
              )}>
                {course?.courseCode || "Course"}
              </Badge>
              {b.durationMinutes >= 60 && !b.completed && (
                <span className="text-xs text-muted-foreground">
                  Deep Work ({b.durationMinutes}m)
                </span>
              )}
            </div>
          </div>

          {/* Action button */}
          <button 
            onClick={() => toggleComplete(b)}
            className="self-center flex-shrink-0 p-2 rounded-full hover:bg-muted transition-colors outline-none focus-visible:ring-2 ring-primary"
            aria-label={b.completed ? "Mark incomplete" : "Mark complete"}
          >
            {b.completed ? (
              <CheckCircle2 className="w-7 h-7 text-success fill-success/20" />
            ) : (
              <Circle className="w-7 h-7 text-muted-foreground hover:text-primary transition-colors" />
            )}
          </button>
        </div>
      </AnimatedCard>
    );
  };

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-primary/10 p-3 rounded-2xl border-2 border-primary/20">
          <Calendar className="w-7 h-7 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground">
            Weekly Planner
          </h1>
          <p className="text-muted-foreground font-medium mt-1">
            Dynamic scheduling powered by your Canvas deadlines.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : (
        <>
          <MorningBriefingCard blocks={todayBlocks} />

          <div className="mt-8 mb-6">
            <h2 className="text-xl font-bold border-b-2 border-border pb-2 mb-4">
              Today's Plan
            </h2>
            
            {todayBlocks.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-border rounded-xl bg-muted/30">
                <p className="text-muted-foreground font-medium">No study blocks scheduled for today.</p>
                <p className="text-sm text-muted-foreground mt-1">Enjoy your free time!</p>
              </div>
            ) : (
              <AnimatedCardList>
                {todayBlocks.map(renderBlock)}
              </AnimatedCardList>
            )}
          </div>

          {upcomingBlocks.length > 0 && (
            <div className="mt-12 opacity-80">
              <h2 className="text-lg font-bold border-b-2 border-muted pb-2 mb-4 text-muted-foreground flex items-center justify-between">
                <span>Looking Ahead</span>
                <span className="text-xs font-normal bg-muted px-2 py-0.5 rounded-full">{upcomingBlocks.length} blocks</span>
              </h2>
              <AnimatedCardList>
                {upcomingBlocks.map(renderBlock)}
              </AnimatedCardList>
            </div>
          )}
        </>
      )}
    </div>
  );
}
