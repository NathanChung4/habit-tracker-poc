"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function AuthCard() {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setIsLoading(true);

    if (mode === "sign-in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(error.message);
      } else {
        router.push("/today");
        router.refresh();
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setMessage(error.message);
      } else {
        setMessage("Account created. If email confirmations are disabled, you can sign in now.");
        setMode("sign-in");
      }
    }

    setIsLoading(false);
  };

  return (
    <section className="panel auth-card">
      <header className="auth-toggle">
        <button
          type="button"
          className={mode === "sign-in" ? "active" : ""}
          onClick={() => setMode("sign-in")}
        >
          Sign in
        </button>
        <button
          type="button"
          className={mode === "sign-up" ? "active" : ""}
          onClick={() => setMode("sign-up")}
        >
          Create account
        </button>
      </header>

      <form onSubmit={onSubmit} className="stack-form">
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />
        </label>
        <button type="submit" className="primary" disabled={isLoading}>
          {mode === "sign-in" ? "Sign in" : "Create account"}
        </button>
        {message ? <p className="muted">{message}</p> : null}
      </form>
    </section>
  );
}
