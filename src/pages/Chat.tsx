import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, Save, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import {
  getConversation,
  saveMessages,
  type LocalConversation,
  type LocalMsg,
} from "@/lib/localChatStore";

type ChatErrorResponse = {
  ok?: false;
  code?: "RATE_LIMIT" | "NO_CREDITS" | "BAD_REQUEST" | "UPSTREAM_ERROR" | "SERVER_ERROR";
  error?: string;
  retryAfterMs?: number;
};

const Chat = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [convo, setConvo] = useState<LocalConversation | null>(null);
  const [messages, setMessages] = useState<LocalMsg[]>([]);
  const [input, setInput] = useState("");
  const [busyCount, setBusyCount] = useState(0); // # of in-flight AI replies
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [rateLimitUntil, setRateLimitUntil] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<LocalMsg[]>([]);
  messagesRef.current = messages;

  useEffect(() => {
    if (!loading && !user) navigate("/", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user || !id) return;
    const c = getConversation(user.id, id);
    if (!c) {
      toast.error("Chat not found");
      navigate("/select");
      return;
    }
    setConvo(c);
    setMessages(c.messages);
  }, [user, id, navigate]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busyCount]);

  useEffect(() => {
    if (!rateLimitUntil) return;
    const remaining = rateLimitUntil - Date.now();
    if (remaining <= 0) {
      setRateLimitUntil(null);
      return;
    }
    const timer = window.setTimeout(() => setRateLimitUntil(null), remaining);
    return () => window.clearTimeout(timer);
  }, [rateLimitUntil]);

  // Keep cursor focused on the input bar.
  useEffect(() => {
    inputRef.current?.focus();
  }, [convo, busyCount, messages.length]);

  const send = async () => {
    if (!input.trim() || !convo) return;
    if (rateLimitUntil && Date.now() < rateLimitUntil) {
      const seconds = Math.max(1, Math.ceil((rateLimitUntil - Date.now()) / 1000));
      toast.error(`Please wait ${seconds}s before sending another message`);
      return;
    }

    const userMsg: LocalMsg = { role: "user", content: input.trim() };
    // Snapshot history sent to the model = everything visible up to now.
    const historyForModel = [...messagesRef.current, userMsg];
    setMessages((prev) => [...prev, userMsg]);
    setDirty(true);
    setInput("");
    setBusyCount((n) => n + 1);
    // Refocus input immediately so the user can keep typing.
    requestAnimationFrame(() => inputRef.current?.focus());

    const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
    let assistantSoFar = "";
    let assistantInserted = false;

    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        if (!assistantInserted) {
          assistantInserted = true;
          return [...prev, { role: "assistant", content: assistantSoFar }];
        }
        // Update the last assistant message we appended (find from end).
        const next = [...prev];
        for (let i = next.length - 1; i >= 0; i--) {
          if (next[i].role === "assistant") {
            next[i] = { ...next[i], content: assistantSoFar };
            break;
          }
        }
        return next;
      });
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: historyForModel,
          character: convo.character_name,
          anime: convo.anime,
        }),
      });

      const contentType = resp.headers.get("content-type") ?? "";
      const isJsonError = contentType.includes("application/json");

      if (!resp.ok || !resp.body || isJsonError) {
        let payload: ChatErrorResponse | null = null;
        try {
          payload = await resp.json();
        } catch {
          payload = null;
        }

        if (resp.status === 429 || payload?.code === "RATE_LIMIT") {
          const retryAfterMs = payload?.retryAfterMs ?? 20000;
          setRateLimitUntil(Date.now() + retryAfterMs);
          toast.error(payload?.error ?? "Too many messages — please wait ~20s and try again");
        } else if (resp.status === 402 || payload?.code === "NO_CREDITS") {
          toast.error(payload?.error ?? "Out of AI credits — add funds in workspace settings");
        } else {
          toast.error(payload?.error ?? "Chat failed");
        }
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let done = false;

      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        textBuffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, idx);
          textBuffer = textBuffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = `${line}\n${textBuffer}`;
            break;
          }
        }
      }

      if (assistantSoFar) setDirty(true);
    } catch (error) {
      console.error(error);
      toast.error("Connection lost");
    } finally {
      setBusyCount((n) => Math.max(0, n - 1));
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const handleSave = async () => {
    if (!user || !id || !dirty) {
      toast.info("Nothing new to save");
      return;
    }
    setSaving(true);
    try {
      saveMessages(user.id, id, messagesRef.current);
      setDirty(false);
      toast.success("Chat saved ✨");
    } catch (e) {
      toast.error("Could not save chat");
    } finally {
      setSaving(false);
      inputRef.current?.focus();
    }
  };

  if (!convo) {
    return (
      <div className="stars min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary relative z-10" />
      </div>
    );
  }

  return (
    <div className="stars relative h-screen overflow-hidden">
      <header className="fixed top-0 left-0 right-0 z-20 glass border-b border-border/40 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/select")} className="text-muted-foreground hover:text-foreground transition-cosmic">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-10 h-10 rounded-full bg-aurora flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{convo.character_name}</div>
          <div className="text-xs text-muted-foreground truncate">{convo.anime}</div>
        </div>
        <Button onClick={handleSave} disabled={saving || !dirty} variant="cosmic-outline" size="sm">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" />Save chat{dirty && " •"}</>}
        </Button>
      </header>

      <div ref={scrollRef} className="absolute inset-0 z-10 overflow-y-auto pt-20 pb-28 px-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-12 animate-fade-in">
              Say hi to <span className="text-aurora font-semibold">{convo.character_name}</span> ✨
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  m.role === "user"
                    ? "bg-aurora text-primary-foreground shadow-cosmic"
                    : "glass text-foreground"
                }`}
              >
                <div className="prose prose-invert prose-sm max-w-none prose-p:my-1">
                  <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          {busyCount > 0 && (
            <div className="flex justify-start">
              <div className="glass rounded-2xl px-4 py-3 text-muted-foreground inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">{busyCount > 1 ? `${busyCount} replies pending…` : "thinking…"}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 glass border-t border-border/40 p-4">
        <form
          onSubmit={(e) => { e.preventDefault(); send(); }}
          className="max-w-2xl mx-auto flex gap-2"
        >
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Message ${convo.character_name}...`}
            autoFocus
            className="bg-input/60 flex-1"
          />
          <Button type="submit" variant="hero" size="icon" disabled={!input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
