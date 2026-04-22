import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Mail } from "lucide-react";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
    toast.success("Reset link sent — check your inbox");
  };

  return (
    <div className="stars relative min-h-screen flex items-center justify-center p-4">
      <div className="relative z-10 w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-cosmic mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to login
        </Link>
        <div className="glass rounded-3xl p-8 shadow-cosmic animate-fade-in">
          <Mail className="w-10 h-10 text-secondary mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-center mb-2 text-aurora">Forgot password?</h1>
          <p className="text-center text-muted-foreground text-sm mb-6">
            Enter your email and we'll send a reset link.
          </p>
          {sent ? (
            <p className="text-center text-secondary">Check your inbox ✨</p>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-input/60" />
              </div>
              <Button type="submit" disabled={busy} variant="hero" className="w-full">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send reset link"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
