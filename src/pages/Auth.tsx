import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { auth, isAdminEmail, signInWithGoogle } from "@/lib/firebase";
import { toast } from "sonner";

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        if (isAdminEmail(user.email)) {
          navigate("/admin", { replace: true });
        } else {
          navigate("/status", { replace: true });
        }
      } else {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [navigate]);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    try {
      const user = await signInWithGoogle();
      if (isAdminEmail(user.email)) {
        navigate("/admin", { replace: true });
      } else {
        navigate("/status", { replace: true });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown auth error";
      const lower = message.toLowerCase();

      if (lower.includes("popup-closed-by-user")) {
        toast.error("Google sign-in popup was closed before completion.");
      } else if (lower.includes("operation-not-allowed")) {
        toast.error("Google sign-in is disabled. Enable it in Firebase Authentication.");
      } else {
        toast.error("Google sign-in failed. Please check Firebase settings.");
      }
    } finally {
      setSigningIn(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-lg p-6 space-y-6 shadow-glow">
        <div className="text-center space-y-2">
          <h1 className="font-display text-3xl font-bold tracking-wider text-primary">XENON LABS</h1>
          <p className="text-sm text-muted-foreground uppercase tracking-wide">Sign in to continue</p>
        </div>

        <Button onClick={handleGoogleSignIn} className="w-full" disabled={signingIn}>
          {signingIn ? "Connecting Google..." : "Sign in with Google"}
        </Button>
      </div>
    </div>
  );
};

export default Auth;
