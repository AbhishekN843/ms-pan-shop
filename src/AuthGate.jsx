
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import "./AuthGate.css";

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [member, setMember] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;

      if (error) setError(error.message);
      setSession(data?.session ?? null);
      setChecking(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!active) return;
      setSession(newSession);
      setMember(null);
      setError("");
      setChecking(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function verifyMembership() {
      setMember(null);

      if (!session?.user) return;

      setChecking(true);
      setError("");

      const { data, error: membershipError } = await supabase
        .from("shop_members")
        .select("role, is_active")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!active) return;

      if (membershipError) {
        setError(
          "Could not verify shop membership. Check your database policies and connection."
        );
      } else if (!data || !data.is_active) {
        setError(
          "This account is not an active MS Pan Shop member. Ask the shop owner to authorise it."
        );
      } else {
        setMember(data);
      }

      setChecking(false);
    }

    verifyMembership();

    return () => {
      active = false;
    };
  }, [session]);

  async function handleLogin(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const { error: loginError } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    if (loginError) setError(loginError.message);

    setBusy(false);
  }

  async function handleLogout() {
    setError("");

    const { error: logoutError } = await supabase.auth.signOut();

    if (logoutError) setError(logoutError.message);
  }

  if (checking) {
    return <div className="auth-loading">Checking your MS Pan Shop access...</div>;
  }

  if (session && member) {
    return (
      <>
        <div className="auth-bar">
          <span>
            Signed in as <strong>{session.user.email}</strong>
            <span className="role-label">{member.role}</span>
          </span>
          <button onClick={handleLogout}>Sign out</button>
        </div>
        {children}
      </>
    );
  }

  if (session && !member) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="auth-logo">MS</div>
          <h1>MS Pan Shop</h1>
          <p>Your account needs shop access.</p>
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="auth-submit" onClick={handleLogout}>
            Sign out
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-logo">MS</div>
        <h1>MS Pan Shop</h1>
        <p>Sign in to your shop account</p>

        <form onSubmit={handleLogin}>
          <label htmlFor="login-email">Email address</label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
          />

          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            required
          />

          {error && <div className="auth-error" role="alert">{error}</div>}

          <button className="auth-submit" disabled={busy}>
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <small>Access is limited to authorised shop members.</small>
      </section>
    </main>
  );
}
