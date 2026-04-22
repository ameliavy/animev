import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageSquare, Trash2, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  listConversations,
  deleteConversation,
  type LocalConversation,
} from "@/lib/localChatStore";

const History = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [convos, setConvos] = useState<LocalConversation[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate("/", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    setConvos(listConversations(user.id));
    setFetching(false);
  }, [user]);

  const handleDelete = (id: string) => {
    if (!user) return;
    deleteConversation(user.id, id);
    setConvos((c) => c.filter((x) => x.id !== id));
    toast.success("Chat deleted");
  };

  return (
    <div className="stars relative min-h-screen p-4 sm:p-8">
      <div className="relative z-10 max-w-3xl mx-auto">
        <header className="flex items-center justify-between mb-8 animate-fade-in">
          <button onClick={() => navigate("/select")} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-cosmic">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <Button variant="cosmic-outline" size="sm" onClick={() => navigate("/select")}>
            <Plus className="w-4 h-4 mr-2" /> New chat
          </Button>
        </header>

        <h1 className="text-3xl font-bold text-aurora mb-2">Your chats</h1>
        <p className="text-muted-foreground mb-6">Resume any conversation — your characters are waiting.</p>

        {fetching ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : convos.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
            No chats yet. Start one from the universe selector.
          </div>
        ) : (
          <div className="space-y-3">
            {convos.map(c => (
              <div key={c.id} className="glass rounded-2xl p-4 flex items-center gap-4 hover:glow-accent transition-cosmic group">
                <div className="w-12 h-12 rounded-xl bg-aurora flex items-center justify-center shrink-0">
                  <MessageSquare className="w-6 h-6 text-primary-foreground" />
                </div>
                <button onClick={() => navigate(`/chat/${c.id}`)} className="flex-1 text-left">
                  <div className="font-semibold text-foreground">{c.character_name}</div>
                  <div className="text-sm text-muted-foreground">{c.anime} · {new Date(c.updated_at).toLocaleString()}</div>
                </button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)} className="opacity-0 group-hover:opacity-100 transition-cosmic text-destructive hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Keep supabase import to avoid bundler tree-shake removal warnings if any
void supabase;

export default History;
