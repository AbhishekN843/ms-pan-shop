import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!email.trim() || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw error;
      }

      setSession(data.session);
    } catch (err) {
      console.error("Login failed:", err);
      setErrorMessage(
        err.message || "Invalid credentials. Please verify your email and password."
      );
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

  // Otherwise, render Owner Login Gate
  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* Brand Header */}
        <div className="auth-brand">
          <div className="auth-logo-badge">MS</div>
          <h1 className="auth-shop-title">MS PAN SHOP</h1>
          <p className="auth-shop-subtitle">Owner & Cashier Portal</p>
        </div>

        {errorMessage && (
          <div className="alert-danger text-sm mb-4">
            ⚠️ {errorMessage}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="auth-form">
          <div className="form-group">
            <label className="form-label">Shop Owner Email</label>
            <input
              type="email"
              className="form-input"
              placeholder="e.g. owner@mspan.com"
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
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
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
                <span className="spinner" /> Signing In...
              </span>
            ) : (
              "Sign In to MS Pan Shop"
            )}
          </button>
        </form>

        <div className="auth-footer-note">
          <p>Protected by Supabase Row Level Security.</p>
          <p className="text-xs text-gray-400 mt-1">
            Accounts are managed by the Shop Administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
