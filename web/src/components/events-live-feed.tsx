import { MicIcon, MicOffIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useGateway } from "@/context/gateway-context";
import { gatewayFetchPath } from "@/lib/gateway";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";

type Ev = {
  ts?: number;
  kind?: string;
  message?: string;
};

export function EventsLiveFeed() {
  const { gatewayBase } = useGateway();
  const [events, setEvents] = useState<Ev[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [micOn, setMicOn] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<{ stop: () => void } | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const r = await fetch(
        `${gatewayFetchPath(gatewayBase, "/events")}?limit=80`,
      );
      const j = (await r.json()) as { events?: Ev[] };
      setEvents(Array.isArray(j.events) ? j.events : []);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load events");
    }
  }, [gatewayBase]);

  useEffect(() => {
    const kick = window.setTimeout(() => void fetchEvents(), 0);
    const t = window.setInterval(() => void fetchEvents(), 12_000);
    return () => {
      window.clearTimeout(kick);
      window.clearInterval(t);
    };
  }, [fetchEvents]);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [events, autoScroll]);

  useEffect(() => {
    const win = window as unknown as {
      SpeechRecognition?: new () => { start: () => void; stop: () => void; continuous: boolean; lang: string; interimResults: boolean; onresult: (() => void) | null; onerror: (() => void) | null };
      webkitSpeechRecognition?: new () => { start: () => void; stop: () => void; continuous: boolean; lang: string; interimResults: boolean; onresult: (() => void) | null; onerror: (() => void) | null };
    };
    const SR = typeof window !== "undefined" ? win.SpeechRecognition || win.webkitSpeechRecognition : undefined;
    if (!micOn || !SR) {
      if (recRef.current) {
        try {
          recRef.current.stop();
        } catch {
          /* noop */
        }
        recRef.current = null;
      }
      return;
    }
    const r = new SR();
    r.lang = "en-US";
    r.continuous = true;
    r.interimResults = false;
    r.onresult = () => void fetchEvents();
    r.onerror = () => setMicOn(false);
    try {
      r.start();
      recRef.current = r;
    } catch {
      window.setTimeout(() => setMicOn(false), 0);
    }
    return () => {
      try {
        r.stop();
      } catch {
        /* noop */
      }
    };
  }, [micOn, fetchEvents]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Live gateway events</CardTitle>
            <CardDescription>
              Polls <code className="text-xs">GET /events</code> — enable mic for
              browser speech hints (where supported).
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={autoScroll} onCheckedChange={setAutoScroll} />
              <Label className="text-sm">Auto-scroll</Label>
            </div>
            <Button
              onClick={() => setMicOn(!micOn)}
              size="sm"
              variant={micOn ? "secondary" : "outline"}
            >
              {micOn ? (
                <MicIcon className="size-4" />
              ) : (
                <MicOffIcon className="size-4" />
              )}
              Mic
            </Button>
            <Button onClick={() => void fetchEvents()} size="sm" variant="outline">
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardPanel>
        {err ? (
          <Alert variant="error">
            <AlertTitle>Events</AlertTitle>
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        ) : null}
        <ScrollArea className="h-56 rounded-lg border bg-muted/20 p-3">
          <ul className="space-y-2 font-mono text-xs">
            {events.map((e, i) => (
              <li key={`${e.ts ?? i}-${i}`}>
                <span className="text-muted-foreground">
                  [{e.kind ?? "—"}]
                </span>{" "}
                {e.message ?? "—"}
              </li>
            ))}
          </ul>
          <div ref={bottomRef} />
        </ScrollArea>
      </CardPanel>
    </Card>
  );
}
