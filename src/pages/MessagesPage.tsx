"use client";

import { useState } from "react";
import useSWR from "swr";
import { Mail, MailOpen, ArrowLeft, Send, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Participant {
  id: number;
  name: string;
  full_name?: string;
  pronouns?: string | null;
}

interface Conversation {
  id: number;
  subject: string;
  workflow_state: string;
  last_message: string;
  last_message_at: string;
  message_count: number;
  participants: Participant[];
  context_name?: string;
  context_code?: string;
  avatar_url?: string;
}

interface ConversationDetail {
  id: number;
  subject: string;
  participants: Participant[];
  messages: {
    id: number;
    created_at: string;
    body: string;
    author_id: number;
    participating_user_ids: number[];
  }[];
  context_name?: string;
}

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const avatarColors = ["#7B1FA2", "#00838F", "#1565C0", "#2E7D32", "#E65100", "#AD1457", "#4527A0"];

export default function MessagesPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const { data: conversations, isLoading: listLoading } = useSWR<Conversation[]>(
    "/api/canvas/conversations",
    fetcher
  );

  const { data: detail, isLoading: detailLoading, mutate: mutateDetail } = useSWR<ConversationDetail>(
    selectedId ? `/api/canvas/conversations/${selectedId}` : null,
    fetcher
  );

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedId) return;
    setSendingReply(true);
    try {
      const res = await fetch(`/api/canvas/conversations/${selectedId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: replyText.trim() }),
      });
      if (res.ok) {
        setReplyText("");
        mutateDetail();
      }
    } finally {
      setSendingReply(false);
    }
  };

  const convoList = conversations || [];

  return (
    <div>
      <div className="mb-0.5 flex items-center gap-2">
        <Mail className="h-7 w-7 text-foreground" />
        <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">Your Canvas inbox</p>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_1fr]">
        {/* Conversation list */}
        <Card className="border-2 lg:max-h-[calc(100vh-200px)] lg:overflow-auto">
          <CardContent className="p-0">
            {listLoading && [1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="border-b border-border p-4">
                <div className="flex gap-3">
                  <Skeleton className="h-10 w-10 flex-shrink-0 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-3/5" />
                    <Skeleton className="h-3.5 w-4/5" />
                    <Skeleton className="h-3 w-2/5" />
                  </div>
                </div>
              </div>
            ))}

            {!listLoading && convoList.length === 0 && (
              <div className="p-8 text-center">
                <Mail className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
                <p className="mb-1 text-sm font-semibold">No messages</p>
                <p className="text-xs text-muted-foreground">Your Canvas inbox is empty.</p>
              </div>
            )}

            {convoList.map((convo) => {
              const isUnread = convo.workflow_state === "unread";
              const isSelected = convo.id === selectedId;
              const otherParticipants = convo.participants.filter((p) => p.name !== "Vedant Misra");
              const displayParticipants = otherParticipants.length > 0 ? otherParticipants : convo.participants;

              return (
                <div
                  key={convo.id}
                  onClick={() => setSelectedId(convo.id)}
                  className={`cursor-pointer border-b border-border p-4 transition-colors ${
                    isSelected ? "bg-muted" : isUnread ? "bg-blue-50/40" : ""
                  } hover:bg-muted/60`}
                >
                  <div className="flex gap-3">
                    {/* Avatar group */}
                    <div className="flex flex-shrink-0">
                      {displayParticipants.slice(0, 2).map((p, idx) => (
                        <Avatar
                          key={p.id}
                          className={`h-9 w-9 border-2 border-background text-[11px] ${idx > 0 ? "-ml-2" : ""}`}
                          style={{ backgroundColor: avatarColors[Math.abs(p.id) % avatarColors.length] }}
                        >
                          <AvatarFallback
                            className="text-[11px] text-white"
                            style={{ backgroundColor: avatarColors[Math.abs(p.id) % avatarColors.length] }}
                          >
                            {getInitials(p.name)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex items-center gap-1.5">
                        {isUnread && <MailOpen className="h-3.5 w-3.5 flex-shrink-0 text-blue-600" />}
                        <p className={`truncate text-sm ${isUnread ? "font-bold" : "font-semibold"}`}>
                          {displayParticipants.map((p) => p.name.split(" ")[0]).join(", ")}
                        </p>
                        <span className="ml-auto flex-shrink-0 text-[11px] text-muted-foreground">
                          {timeAgo(convo.last_message_at)}
                        </span>
                      </div>
                      <p className={`truncate text-xs ${isUnread ? "font-semibold text-foreground" : "text-foreground/80"}`}>
                        {convo.subject}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">{convo.last_message}</p>
                      {convo.context_name && (
                        <Badge className="mt-1 h-4 border-0 bg-muted text-[10px] text-muted-foreground">
                          {convo.context_name}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Conversation detail */}
        <Card className="border-2 lg:max-h-[calc(100vh-200px)] lg:overflow-auto">
          <CardContent className="p-5">
            {!selectedId && (
              <div className="py-16 text-center">
                <Mail className="mx-auto mb-3 h-16 w-16 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Select a conversation to read it</p>
              </div>
            )}

            {selectedId && detailLoading && (
              <div className="space-y-3">
                <Skeleton className="h-6 w-3/5" />
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </div>
            )}

            {selectedId && !detailLoading && detail && (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <button
                    onClick={() => setSelectedId(null)}
                    className="rounded-lg p-1.5 transition-colors hover:bg-muted lg:hidden"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div>
                    <h2 className="text-base font-bold leading-tight">{detail.subject}</h2>
                    {detail.context_name && (
                      <p className="text-xs text-muted-foreground">{detail.context_name}</p>
                    )}
                  </div>
                </div>

                <div className="mb-4 flex flex-wrap gap-1.5">
                  {detail.participants?.map((p) => (
                    <Badge key={p.id} variant="outline" className="h-5 text-[11px]">{p.name}</Badge>
                  ))}
                </div>

                <div className="space-y-3">
                  {detail.messages?.map((msg) => {
                    const author = detail.participants?.find((p) => p.id === msg.author_id);
                    const isMe = author?.name === "Vedant Misra";
                    return (
                      <div
                        key={msg.id}
                        className={`rounded-xl p-3 ${isMe ? "ml-16 bg-accent/10" : "mr-16 bg-muted"}`}
                      >
                        <div className="mb-1.5 flex items-center gap-2">
                          <Avatar
                            className="h-7 w-7 text-[10px]"
                            style={{ backgroundColor: avatarColors[Math.abs(msg.author_id) % avatarColors.length] }}
                          >
                            <AvatarFallback
                              className="text-[10px] text-white"
                              style={{ backgroundColor: avatarColors[Math.abs(msg.author_id) % avatarColors.length] }}
                            >
                              {author ? getInitials(author.name) : "?"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-semibold">{author?.name || "Unknown"}</span>
                          <span className="ml-auto text-[11px] text-muted-foreground">
                            {new Date(msg.created_at).toLocaleString("en-US", {
                              month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <div
                          className="text-sm leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: msg.body }}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Reply box */}
                <div className="mt-4">
                  <Separator className="mb-4" />
                  <p className="mb-2 text-xs font-semibold">Reply</p>
                  <Textarea
                    placeholder="Write your reply..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={3}
                    disabled={sendingReply}
                    className="mb-3 border-2"
                  />
                  <Button
                    size="sm"
                    onClick={handleSendReply}
                    disabled={!replyText.trim() || sendingReply}
                  >
                    {sendingReply ? (
                      <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Sending...</>
                    ) : (
                      <><Send className="mr-2 h-3.5 w-3.5" />Send Reply</>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
