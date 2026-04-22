import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, Save, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };
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

  const [convo, setConvo] = useState<{ anime: string; character_name: string } | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [pendingSave, setPendingSave] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rateLimitUntil, setRateLimitUntil] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user || !id) return;
    (async () => {
      const { data: c, error } = await supabase
        .from("conversations")
        .select("anime, character_name")
        .eq("id", id)
        .single();
      if (error || !c) {
        toast.error("Chat not found");
        navigate("/select");
        return;
      }
      setConvo(c);
      const { data: msgs } = await supabase
        .from("messages")
        .select("role, content")
        .eq("conversation_id", id)
        .order("created_at");
      setMessages((msgs as Msg[]) ?? []);
    })();
  }, [user, id, navigate]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const send = async () => {
    if (!input.trim() || !convo || streaming) return;
    const userMsg: Msg = { role: "user", content: input.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setPendingSave(p => [...p, userMsg]);
    setInput("");
    setStreaming(true);

    const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
    let assistantSoFar = "";
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
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
          messages: next,
          character: convo.character_name,
          anime: convo.anime,
        }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) toast.error("Too many messages — please wait ~20s and try again");
        else if (resp.status === 402) toast.error("Out of AI credits — add funds in workspace settings");
        else toast.error("Chat failed");
        // Roll back optimistic user message so they can retry without a stuck UI
        setMessages(prev => prev.filter((_, i) => i !== prev.length - 1 || prev[prev.length - 1].role !== "user" || prev[prev.length - 1].content !== userMsg.content));
        setPendingSave(p => p.filter(m => m !== userMsg));
        setInput(userMsg.content);
        setStreaming(false);
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
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (c) upsert(c);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      if (assistantSoFar) {
        setPendingSave(p => [...p, { role: "assistant", content: assistantSoFar }]);
      }
    } catch (e) {
      console.error(e);
      toast.error("Connection lost");
    } finally {
      setStreaming(false);
    }
  };

  const handleSave = async () => {
    if (!user || !id || pendingSave.length === 0) {
      toast.info("Nothing new to save");
      return;
    }
    setSaving(true);
    const rows = pendingSave.map(m => ({
      conversation_id: id,
      user_id: user.id,
      role: m.role,
      content: m.content,
    }));
    const { error } = await supabase.from("messages").insert(rows);
    // Bump updated_at
    await supabase.from("conversations").update({ anime: convo?.anime ?? "" }).eq("id", id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPendingSave([]);
    toast.success("Chat saved ✨");
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
        <Button onClick={handleSave} disabled={saving || pendingSave.length === 0} variant="cosmic-outline" size="sm">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" />Save chat{pendingSave.length > 0 && ` (${pendingSave.length})`}</>}
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
          {streaming && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex justify-start">
              <div className="glass rounded-2xl px-4 py-3 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin inline" />
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
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Message ${convo.character_name}...`}
            disabled={streaming}
            className="bg-input/60 flex-1"
          />
          <Button type="submit" variant="hero" size="icon" disabled={streaming || !input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
