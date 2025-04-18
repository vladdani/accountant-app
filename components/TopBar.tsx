'use client';

import Link from 'next/link';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';
import { LogOut, Files } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

// TopBar component handles user profile display and navigation
export default function TopBar() {
  const { user, signOut } = useAuth();

  // Add a debug log to check user status
  console.log("TopBar render - User state:", !!user, user?.email);

  // Handle user logout
  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex h-16 items-center justify-between w-full max-w-full">
        <div className="flex items-center">
          <Link href="/" className="flex items-center space-x-2">
            <Files className="h-7 w-7 text-primary" />
            <span className="text-2xl font-bold">CariNota</span>
          </Link>
          <nav className="hidden md:flex items-center ml-10 space-x-4">
            {/* Add other nav links if needed */}
            {/* Example: <Link href="/features" className={pathname === '/features' ? 'font-bold' : ''}>Features</Link> */}
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          {user ? (
            <>
              {/* Always show Dashboard button when user is logged in */}
              <Button asChild>
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Avatar className="h-8 w-8 cursor-pointer">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {user.email?.charAt(0).toUpperCase() ?? 'A'} 
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard">Dashboard</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/profile">Profile & Billing</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-red-600 dark:text-red-400 cursor-pointer focus:bg-red-100 dark:focus:bg-red-900/50 focus:text-red-700 dark:focus:text-red-300">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              {/* Simplify to a single CTA button for non-logged in users */}
              <Button asChild>
                <Link href="/login">Try CariNota For Free</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
} 