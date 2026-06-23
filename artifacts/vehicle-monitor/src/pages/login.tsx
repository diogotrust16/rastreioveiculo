import React, { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import { useLogin } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Target, Loader2 } from 'lucide-react';

export default function Login() {
  const { setToken } = useAuth();
  const [_, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        setToken(data.accessToken);
        setLocation('/dashboard');
      },
      onError: (err: any) => {
        setError(err.message || 'Invalid credentials');
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    loginMutation.mutate({ data: { email, password } });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md p-8 relative z-10">
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-secondary border border-border flex items-center justify-center mb-6 shadow-2xl relative">
            <div className="absolute inset-0 bg-primary/20 animate-pulse rounded-2xl blur-md" />
            <Target className="w-8 h-8 text-primary relative z-10" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            FLEET<span className="text-primary">WATCH</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-sm text-center">
            Mission control for your fleet operations
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-xl backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm font-medium">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="dispatcher@company.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
                className="bg-secondary/50 border-border focus:border-primary transition-colors"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
              </div>
              <Input 
                id="password" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
                className="bg-secondary/50 border-border focus:border-primary transition-colors"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-11 text-base font-semibold" 
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enter Command Center'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
