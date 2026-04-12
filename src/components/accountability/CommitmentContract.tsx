"use client";

import { useState } from "react";
import { Handshake, User, Mail, Pencil, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { MonitorInfo } from "@/hooks/useAccountability";

interface Props {
  monitor: MonitorInfo | null;
  onSave: (m: MonitorInfo) => void;
  onClear: () => void;
}

const STEPS = ["Designate Monitor", "Write Pledge", "Confirm"];

export default function CommitmentContract({ monitor, onSave, onClear }: Props) {
  const [editing, setEditing] = useState(!monitor);
  const [step, setStep] = useState(0);
  const [name, setName] = useState(monitor?.name ?? "");
  const [email, setEmail] = useState(monitor?.email ?? "");
  const [pledge, setPledge] = useState(monitor?.pledge ?? "");

  const canNext =
    step === 0
      ? name.trim().length > 0 && email.includes("@")
      : step === 1
        ? pledge.trim().length > 10
        : true;

  const handleNext = () => {
    if (step < 2) {
      setStep(step + 1);
    } else {
      onSave({
        name: name.trim(),
        email: email.trim(),
        pledge: pledge.trim(),
        createdAt: new Date().toISOString(),
      });
      setEditing(false);
    }
  };

  const handleEdit = () => {
    setStep(0);
    setEditing(true);
  };

  if (!editing && monitor) {
    return (
      <Card className="border-2">
        <CardContent className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Handshake className="h-5 w-5 text-foreground" />
              <h3 className="text-base font-bold">Commitment Contract</h3>
            </div>
            <button
              onClick={handleEdit}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-4 flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-border">
              <AvatarFallback className="bg-muted text-foreground text-sm font-bold">
                {monitor.name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold">{monitor.name}</p>
              <p className="text-xs text-muted-foreground">{monitor.email}</p>
            </div>
            <Badge
              variant="outline"
              className="ml-auto border-green-300 bg-green-50 text-green-800 font-semibold text-xs"
            >
              Active Monitor
            </Badge>
          </div>

          <Separator className="my-4" />

          <p className="rounded-xl border-l-4 border-accent bg-muted px-4 py-3 text-sm italic leading-relaxed text-muted-foreground">
            &ldquo;{monitor.pledge}&rdquo;
          </p>

          <div className="mt-4 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onClear();
                setEditing(true);
                setName("");
                setEmail("");
                setPledge("");
              }}
              className="text-xs text-muted-foreground"
            >
              Remove Contract
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2">
      <CardContent className="p-6">
        <div className="mb-5 flex items-center gap-3">
          <Handshake className="h-5 w-5 text-foreground" />
          <h3 className="text-base font-bold">Set Up Commitment Contract</h3>
        </div>

        {/* Custom stepper */}
        <div className="mb-6 flex items-center">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors",
                    i < step
                      ? "border-accent bg-accent text-accent-foreground"
                      : i === step
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-muted-foreground"
                  )}
                >
                  {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </div>
                <span
                  className={cn(
                    "hidden text-[10px] sm:block whitespace-nowrap",
                    i === step ? "font-semibold text-foreground" : "text-muted-foreground"
                  )}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "mx-2 mb-4 h-[2px] w-8 transition-colors",
                    i < step ? "bg-accent" : "bg-border"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 0 */}
        {step === 0 && (
          <div className="flex flex-col gap-4">
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Monitor Name (e.g., Dr. Chen)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="monitor@university.edu"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        )}

        {/* Step 1 */}
        {step === 1 && (
          <Textarea
            placeholder="I commit to completing at least one meaningful study task every day..."
            value={pledge}
            onChange={(e) => setPledge(e.target.value)}
            rows={3}
          />
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="rounded-xl bg-muted p-5">
            <p className="mb-3 text-sm font-semibold">Review Your Commitment</p>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <span className="min-w-[60px] text-xs font-semibold">Monitor:</span>
                <span className="text-xs">
                  {name} ({email})
                </span>
              </div>
              <div className="flex gap-2">
                <span className="min-w-[60px] text-xs font-semibold">Pledge:</span>
                <span className="text-xs italic">&ldquo;{pledge}&rdquo;</span>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-xs font-semibold text-green-700">
                Your monitor will be notified if a streak is broken.
              </span>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={step === 0}
            onClick={() => setStep(step - 1)}
          >
            Back
          </Button>
          <Button size="sm" disabled={!canNext} onClick={handleNext}>
            {step === 2 ? "Activate Contract" : "Next"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
