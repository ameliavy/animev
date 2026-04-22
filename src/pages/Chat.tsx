import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, Save, Loader2, Sparkles, WifiOff, Cpu } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import {
  getConversation,
  saveMessages,
  type LocalConversation,
  type LocalMsg,
} from "@/lib/localChatStore";
import {
  getEngine,
  isWebGPUSupported,
  onProgress,
  streamLocalChat,
  type LocalMsg as AIMsg,
} from "@/lib/localAI";

const Chat = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [convo, setConvo] = useState<LocalConversation | null>(null);
  const [messages, setMessages] = useState<LocalMsg[]>([]);
  const [input, setInput] = useState("");
  const [busyCount, setBusyCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Local-AI loading state
  const [modelReady, setModelReady] = useState(false);
  const [modelProgress, setModelProgress] = useState(0);
  const [modelText, setModelText] = useState("Preparing on-device AI…");
  const [modelError, setModelError] = useState<string | null>(null);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

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
    inputRef.current?.focus();
  }, [convo, busyCount, messages.length, modelReady]);

  // Track online/offline
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  // Boot the local model
  useEffect(() => {
    if (!convo) return;
    if (!isWebGPUSupported()) {
      setModelError("On-device AI needs WebGPU. Try Chrome on Android or a recent iOS/desktop browser.");
      return;
    }
    const off = onProgress((p) => {
      setModelProgress(Math.round((p.progress ?? 0) * 100));
      setModelText(p.text || "Loading model…");
    });
    let cancelled = false;
    getEngine()
      .then(() => { if (!cancelled) setModelReady(true); })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Failed to load model";
        setModelError(msg);
      });
    return () => {
      cancelled = true;
      off();
    };
  }, [convo]);

  const send = async () => {
    if (!input.trim() || !convo) return;
    if (!modelReady) {
      toast.error("AI is still loading — almost ready!");
      return;
    }

    const userMsg: LocalMsg = { role: "user", content: input.trim() };
    const systemPrompt = `You are ${convo.character_name} from ${convo.anime}. Stay fully in character. Reply with only what you would say — no narration, no actions in asterisks, no descriptions. Keep replies short, casual, and very human-like. Exclamation marks are fine.`;
    const historyForModel: AIMsg[] = [
      { role: "system", content: systemPrompt },
      ...messagesRef.current.map((m) => ({ role: m.role, content: m.content }) as AIMsg),
      { role: "user", content: userMsg.content },
    ];

    setMessages((prev) => [...prev, userMsg]);
    setDirty(true);
    setInput("");
    setBusyCount((n) => n + 1);
    requestAnimationFrame(() => inputRef.current?.focus());

    let assistantSoFar = "";
    let assistantInserted = false;
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        if (!assistantInserted) {
          assistantInserted = true;
          return [...prev, { role: "assistant", content: assistantSoFar }];
        }
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
      await streamLocalChat(historyForModel, upsertAssistant);
      if (assistantSoFar) setDirty(true);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "AI error");
    } finally {
      setBusyCount((n) => Math.max(0, n - 1));
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const handleSave = () => {
    if (!user || !id || !dirty) {
      toast.info("Nothing new to save");
      return;
    }
    setSaving(true);
    try {
      saveMessages(user.id, id, messagesRef.current);
      setDirty(false);
      toast.success("Chat saved ✨");
    } catch {
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
    <div className="stars relative h-[100dvh] overflow-hidden">
      <header className="fixed top-0 left-0 right-0 z-20 glass border-b border-border/40 px-4 py-3 flex items-center gap-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button onClick={() => navigate("/select")} className="text-muted-foreground hover:text-foreground transition-cosmic">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-10 h-10 rounded-full bg-aurora flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate flex items-center gap-2">
            {convo.character_name}
            {!online && <WifiOff className="w-3.5 h-3.5 text-muted-foreground" aria-label="offline" />}
          </div>
          <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
            <Cpu className="w-3 h-3" /> on-device · {convo.anime}
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving || !dirty} variant="cosmic-outline" size="sm">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" />Save{dirty && " •"}</>}
        </Button>
      </header>

      <div ref={scrollRef} className="absolute inset-0 z-10 overflow-y-auto pt-24 pb-32 px-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {!modelReady && !modelError && (
            <div className="glass rounded-2xl p-5 text-sm space-y-3 animate-fade-in">
              <div className="flex items-center gap-2 font-semibold">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                Setting up on-device AI
              </div>
              <p className="text-muted-foreground text-xs">
                The first time takes a minute while the model downloads (~1 GB).
                After that it lives on your device — chat anytime, even without wifi.
              </p>
              <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                <div
                  className="h-full bg-aurora transition-all"
                  style={{ width: `${modelProgress}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground truncate">{modelText}</div>
            </div>
          )}
          {modelError && (
            <div className="glass rounded-2xl p-5 text-sm space-y-2 border border-destructive/40">
              <div className="font-semibold text-destructive">Can't start on-device AI</div>
              <p className="text-muted-foreground text-xs">{modelError}</p>
            </div>
          )}
          {modelReady && messages.length === 0 && (
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

      <div className="fixed bottom-0 left-0 right-0 z-20 glass border-t border-border/40 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <form
          onSubmit={(e) => { e.preventDefault(); send(); }}
          className="max-w-2xl mx-auto flex gap-2"
        >
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={modelReady ? `Message ${convo.character_name}...` : "Loading on-device AI…"}
            autoFocus
            inputMode="text"
            className="bg-input/60 flex-1"
          />
          <Button type="submit" variant="hero" size="icon" disabled={!input.trim() || !modelReady}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
