'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext'; 
import { FcGoogle } from "react-icons/fc";

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signInWithPassword, signInWithGoogle, loading, error } = useAuth(); // Use AuthContext

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await signInWithPassword(email, password); // Call context method
  };

  return (
    <div className="w-full max-w-sm p-8 space-y-6 bg-card rounded-xl shadow-lg">
       <div className="text-center">
         <h1 className="text-2xl font-semibold text-foreground">Welcome Back</h1>
         <p className="text-muted-foreground text-sm mt-1">Sign in to access your dashboard.</p>
       </div>

      <form onSubmit={handleSignIn} className="space-y-4">
        <div>
          <label htmlFor="email" className="sr-only">Email</label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading} // Use loading from context
            className="bg-input border-border"
          />
        </div>
        <div>
          <label htmlFor="password" className="sr-only">Password</label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading} // Use loading from context
            className="bg-input border-border"
          />
        </div>

        {error && (
          <p className="text-xs text-destructive text-center">{error}</p>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Signing In...' : 'Sign In'}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
        </div>
      </div>

      <Button variant="outline" className="w-full border-border" onClick={signInWithGoogle} disabled={loading}>
         <FcGoogle className="mr-2 h-5 w-5" />
         Sign in with Google
      </Button>

      {/* Removed Magic Link Form */}
      {/* Removed Forgot Password Link (handled on login page directly) */}
    </div>
  );
}