import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    // Check active session
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        console.error("Session check error:", error);
      }
      setSession(data?.session ?? null);
      setLoading(false);
    });

    // Listen to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!email.trim() || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }

    setBusy(true);

    try {
      if (isSignUpMode) {
        // Sign Up Mode
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: "Shop Owner" },
          },
        });

        if (error) {
          if (error.message.toLowerCase().includes("rate limit")) {
            throw new Error(
              "Supabase email rate limit exceeded. To disable email limits: In your Supabase Dashboard -> Authentication -> Providers -> Email, turn OFF 'Confirm email', then try again."
            );
          }
          throw error;
        }

        if (data?.session) {
          // Instantly logged in (if auto-confirm enabled)
          setSession(data.session);
        } else if (data?.user) {
          // Email confirmation required by Supabase
          setSuccessMessage(
            "Account created! If your Supabase project requires email verification, check your inbox or turn OFF 'Confirm email' in Supabase Auth settings."
          );
          setIsSignUpMode(false);
        }
      } else {
        // Sign In Mode
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            throw new Error(
              "Account not found or password incorrect. If this is your first time, click 'First-time Owner Setup' below to register your account."
            );
          }
          throw error;
        }

        setSession(data.session);
      }
    } catch (err) {
      console.error("Auth action failed:", err);
      setErrorMessage(err.message || "Authentication failed. Please check your credentials.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-card">
          <div className="spinner-lg" />
          <p className="mt-4 text-sm font-semibold text-gray-700">Loading MS PAN SHOP...</p>
        </div>
      </div>
    );
  }

  // If user is authenticated, render the main application
  if (session && session.user) {
    return children({ session, user: session.user });
  }

  // Otherwise, render Owner Login / Sign Up Gate
  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* Brand Header */}
        <div className="auth-brand">
          <div className="auth-logo-badge">MS</div>
          <h1 className="auth-shop-title">MS PAN SHOP</h1>
          <p className="auth-shop-subtitle">
            {isSignUpMode ? "Create Shop Owner Account" : "Owner & Cashier Portal"}
          </p>
        </div>

        {errorMessage && (
          <div className="alert-danger text-xs mb-4 leading-relaxed">
            ⚠️ {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="alert-success text-xs mb-4 leading-relaxed">
            ✓ {successMessage}
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">Shop Owner Email</label>
            <input
              type="email"
              className="form-input"
              placeholder="e.g. abhu843@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="Enter your password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isSignUpMode ? "new-password" : "current-password"}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-large w-full mt-2"
            disabled={busy}
          >
            {busy ? (
              <span className="flex items-center justify-center gap-2">
                <span className="spinner" /> Processing...
              </span>
            ) : isSignUpMode ? (
              "Create Owner Account"
            ) : (
              "Sign In to MS Pan Shop"
            )}
          </button>
        </form>

        {/* Toggle between Sign In and Sign Up */}
        <div className="text-center mt-4">
          <button
            type="button"
            className="btn-link text-xs font-semibold"
            onClick={() => {
              setIsSignUpMode(!isSignUpMode);
              setErrorMessage("");
              setSuccessMessage("");
            }}
          >
            {isSignUpMode
              ? "← Already have an account? Sign In"
              : "First time setup? Create Owner Account →"}
          </button>
        </div>

        <div className="auth-footer-note">
          <p>Connected to Supabase Project: <strong>MS-PAN</strong></p>
          <p className="text-xs text-gray-400 mt-1">
            Row Level Security active.
          </p>
        </div>
      </div>
    </div>
  );
}
