// src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged, signInWithRedirect, signOut } from "firebase/auth";
import { auth, googleProvider } from "../firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const redirectAttempted = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        if (redirectAttempted.current) return;
        redirectAttempted.current = true;
        // NO ACTIVE SESSION FOUND: Immediately auto-redirect to Google Auth
        console.log("No authenticated session. Redirecting to Google SSO...");
        try {
          // Instructs Google SSO to ask the user to choose their account if needed
          googleProvider.setCustomParameters({ prompt: "select_account" });
          await signInWithRedirect(auth, googleProvider);
        } catch (error) {
          console.error("Error during auto-redirect:", error);
        }
      } else {
        // Active session established!
        setUser(currentUser);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    setLoading(true);
    redirectAttempted.current = false;
    await signOut(auth);
    // onAuthStateChanged will trigger above and auto-redirect back to sign-in
  };

  const getToken = async (): Promise<string | null> => {
    if (!auth.currentUser) return null;
    return await auth.currentUser.getIdToken();
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, getToken }}>
      {/* 
        Prevent children from mounting until the user is authenticated.
        During the brief window before/during redirect, show a loader.
      */}
      {loading ? (
        <div style={spinnerStyle}>
          <h2>Signing you in via Google SSO...</h2>
          <div className="spinner"></div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};

const spinnerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  height: "100vh",
  fontFamily: "sans-serif",
  backgroundColor: "#f8f9fa",
};