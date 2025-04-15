"use client";

// import { useWebSocket } from '@/contexts/WebSocketContext';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { PostgrestError } from '@supabase/supabase-js';

import { useRouter } from 'next/navigation';
import { useSubscription } from '@/hooks/useSubscription';
// import { OnboardingTour } from '@/components/OnboardingTour';
import { useTrialStatus } from '@/hooks/useTrialStatus';
// import { motion } from 'framer-motion';
import { FileUpload } from "@/components/file-upload";
import { 
  // BarChart3, 
  // Users, 
  // CreditCard, 
  Settings,
  // PlusCircle,
  Clock,
  // TrendingUp,
  // Activity,
  Folder,
  Star,
  Inbox,
  // Upload,
  // LogOut, // No longer used in header
  FileText, // Generic document icon
  // Calendar // Commented out, will be used for date filtering later
  MessageSquare,
  Send,
  Loader2,
} from 'lucide-react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // No longer used
import { Button } from "@/components/ui/button";
import Link from 'next/link';
/* // No longer used
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"; 
import { Avatar, AvatarFallback } from "@/components/ui/avatar"; 
*/
import { Skeleton } from "@/components/ui/skeleton";
// Shadcn Table Components
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Import the new action
import { handleUserSearchQueryAction } from '@/app/actions/handle-user-search-query';
// Import CoreMessage type from Vercel AI SDK
import type { CoreMessage } from 'ai';

// Import React Markdown
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Import Input and Textarea components
import { Textarea } from "@/components/ui/textarea";

// --- Types ---
interface Document {
  id: string;
  file_path: string; // Path in storage
  document_url: string; // Public URL
  uploaded_at: string;
  extracted_data?: Record<string, unknown> | null; // Make this optional with ?
  original_filename: string | null;
  // Add new columns from updated schema
  document_type?: string | null;
  document_date?: string | null;
  total_amount?: number | null;
}

// Interface for chat messages
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool'; // Add 'tool' role if you plan to display tool interactions
  content: string | React.ReactNode;
  timestamp: string; // Keep timestamp for display
  // Optional: tool_calls, tool_call_id if needed for rendering
}

// Interface for sidebar filters
interface Filter {
  type: 'special' | 'category' | 'date'; // 'special' = all, recent, starred
  value: string; // e.g., 'all', 'invoice', '2024-03'
}

// --- End Types ---

export default function Dashboard() {
  // --- ALL HOOKS MUST BE CALLED AT THE TOP LEVEL ---
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const { subscription, isLoading: isSubLoading, fetchSubscription } = useSubscription();
  const { isInTrial, isLoading: isTrialLoading } = useTrialStatus();
  const [uploadStatus, setUploadStatus] = useState<string>(""); 
  const [isMobile, setIsMobile] = useState<boolean>(false);
  
  // State for document display and filtering
  const [documents, setDocuments] = useState<Document[]>([]); // Use the updated Document interface
  const [isLoadingDocuments, setIsLoadingDocuments] = useState<boolean>(true);
  const [selectedFilter, setSelectedFilter] = useState<Filter>({ type: 'special', value: 'all' });
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [isLoadingTypes, setIsLoadingTypes] = useState<boolean>(true);
  // TODO: Add state for available dates (years/months) later

  // State for chat
  const [chatInput, setChatInput] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: `asst-init-${Date.now()}`,
      role: 'assistant',
      content: "Hi! I'm your document assistant. How can I help you search through your documents today?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [isLoadingChat, setIsLoadingChat] = useState<boolean>(false);
  const chatContainerRef = useRef<HTMLDivElement>(null); 

  // Check for mobile screen size
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Initial check
    checkIsMobile();
    
    // Add event listener for resize
    window.addEventListener('resize', checkIsMobile);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  // --- Helper Functions for Data Fetching ---
  const fetchTypes = useCallback(async () => {
    if (!user?.id) return;
    
    console.log("Starting fetchTypes for user:", user.id);
    setIsLoadingTypes(true);
    try {
      // Query distinct document types directly from the column
      const { data, error } = await supabase
        .from('documents')
        .select('document_type')
        .eq('uploaded_by', user.id)
        .not('document_type', 'is', null);

      console.log("Types fetch result:", { data, error, userId: user.id });

      if (error) throw error;
      
      // Get unique document types
      const typesSet = new Set(data.map(item => item.document_type));
      const typesArray = Array.from(typesSet);
      
      console.log("Processed document types:", typesArray);
      setAvailableTypes(typesArray);
    } catch (error) {
      console.error("Error fetching document types:", error);
      setAvailableTypes([]); // Set empty on error
    } finally {
      setIsLoadingTypes(false);
    }
  }, [user?.id, supabase]);

  const fetchDocuments = useCallback(async () => {
    if (!user?.id) return;

    console.log("Starting fetchDocuments for user:", user.id, "with filter:", selectedFilter);
    setIsLoadingDocuments(true);
    let query = supabase
      .from('documents')
      .select('id, file_path, document_url, uploaded_at, original_filename, document_type, document_date, total_amount')
      .eq('uploaded_by', user.id);

    // Apply filter logic
    if (selectedFilter.type === 'category') {
      query = query.eq('document_type', selectedFilter.value);
      console.log("Applied category filter:", selectedFilter.value);
    } else if (selectedFilter.type === 'date') {
      // TODO: Implement date filtering logic (e.g., year-month)
      console.log("Date filtering not yet implemented");
    } else if (selectedFilter.type === 'special') {
      if (selectedFilter.value === 'recent') {
        query = query.order('uploaded_at', { ascending: false }).limit(20);
        console.log("Applied recent filter (limit 20)");
      } else if (selectedFilter.value === 'starred') {
        // TODO: Add is_starred column or similar logic
        console.log("Starred filtering not yet implemented");
      } else { // 'all'
        query = query.order('uploaded_at', { ascending: false });
        console.log("Applied all documents filter (sorted by upload date)");
      }
    } else { // Default to all
       query = query.order('uploaded_at', { ascending: false });
       console.log("Applied default filter (all docs, sorted by upload date)");
    }

    try {
      console.log("Executing Supabase query...");
      const { data, error } = await query;
      console.log("Documents query result:", { 
        count: data?.length || 0, 
        error, 
        firstDocument: data && data.length > 0 ? {
          id: data[0].id,
          documentType: data[0].document_type,
          documentDate: data[0].document_date,
          uploadedAt: data[0].uploaded_at,
          originalFilename: data[0].original_filename
        } : null
      });
      
      // Log full data in development only
      if (process.env.NODE_ENV === 'development') {
        console.log("Full documents data:", data);
      }
      
      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error(`Error fetching documents for filter ${selectedFilter.value}:`, error);
      setDocuments([]);
    } finally {
      setIsLoadingDocuments(false);
    }
  }, [user?.id, selectedFilter, supabase]);

  // --- Data Fetching useEffects ---

  // Fetch distinct document types for the sidebar
  useEffect(() => {
    if (user?.id) {
      fetchTypes();
    }
  }, [user?.id, fetchTypes]);

  // Fetch documents based on the selected filter
  useEffect(() => {
    if (user?.id) {
      fetchDocuments();
    }
  }, [user?.id, selectedFilter, fetchDocuments]);

  // --- Other useEffects (Auth, Subscription, Onboarding Checks) --- 

  // Combine initial fetch/refresh and onboarding check
  useEffect(() => {
    if (user?.id) {
      console.log("Dashboard mounted/user changed, forcing subscription fetch.");
      // Force refresh subscription data with skipCache=true
      fetchSubscription(true); 
      
      // Also call the subscription refresh API endpoint
      const refreshSubscription = async () => {
        try {
          console.log("Calling subscription refresh API...");
          const response = await fetch('/api/subscription/refresh', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            console.error("Failed to refresh subscription:", errorData);
            return;
          }
          
          const data = await response.json();
          console.log("Subscription refresh API response:", data);
          
          // If subscription found, force another fetch to sync the client
          if (data.hasActiveSubscription && data.subscription) {
            console.log("Active subscription found, refreshing client state");
            setTimeout(() => fetchSubscription(true), 500);
          }
        } catch (error) {
          console.error("Error calling subscription refresh API:", error);
        }
      };
      
      refreshSubscription();
      
      const checkOnboarding = async () => {
        try {
            // Comment out data assignment if not used
            // const { data: onboardingData, error } = await supabase
            const { error } = await supabase // Only fetch error if data isn't needed
              .from('user_preferences')
              .select('has_completed_onboarding') // Still need to select something
              .eq('user_id', user.id)
              .single();
            
            if (error && (error as PostgrestError)?.code !== 'PGRST116') { // Use PostgrestError type
                 console.error('Error checking onboarding status:', error);
            }
            // else: Row not found or success, do nothing for now
        } catch (error) {
            // Catch any other unexpected errors during the check
            console.error('Unexpected error checking onboarding status:', error);
        }
      };
      checkOnboarding();

    } else {
        // Reset relevant state if user becomes null (if hasCheckedSubscription was used elsewhere)
        // setHasCheckedSubscription(false); 
        console.log("Dashboard mounted/user changed, no user ID found.");
    }
  }, [user?.id, fetchSubscription]);

  // *** REVISED Redirect Effect - Combine checks after loading ***
  useEffect(() => {
    // Wait until all relevant loading states are false
    if (isAuthLoading || isSubLoading || isTrialLoading) {
        console.log("Waiting for loading states...", { isAuthLoading, isSubLoading, isTrialLoading });
        return; 
    }

    // Only perform check if we have definitively loaded user/sub/trial states
    console.log("Checking access permissions...", { user: !!user, subscription, status: subscription?.status, isInTrial });
    
    // Restore hasValidSubscription check with enhanced logging
    const hasValidSubscription = subscription && ['active', 'trialing'].includes(subscription.status);
    
    if (hasValidSubscription) {
      console.log("Valid subscription detected:", subscription.status);
    }
    
    if (isInTrial) {
      console.log("User is in trial period");
    }

    // Only redirect if user is not logged in
    if (!user) {
      console.log("Redirecting to /login: No user found");
      router.replace('/login');
      return;
    }
    
    // If no valid subscription AND no trial, redirect to profile
    if (!hasValidSubscription && !isInTrial) {
      console.log("Redirecting to /profile: No valid subscription or trial", { 
        subscriptionStatus: subscription?.status,
        isInTrial
      });
      router.replace('/profile');
    } else {
      console.log("User has access to dashboard:", { 
        hasValidSubscription,
        subscriptionStatus: subscription?.status,
        isInTrial
      });
    }

  // Depend on the actual data and loading states needed for the decision
  }, [user, subscription, isInTrial, isAuthLoading, isSubLoading, isTrialLoading, router]);

  // Scroll chat useEffect - MUST be here, after all state/ref hooks
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // --- Helper Functions --- 
  const handleUploadSuccess = (url: string) => {
    console.log("Upload successful on dashboard:", url);
    setUploadStatus(`File uploaded successfully! Processing...`);
    // Refresh documents and types after upload (with a small delay for processing)
    setTimeout(() => {
       setSelectedFilter(prev => ({ ...prev })); // Trigger refetch by changing filter state slightly
       // TODO: Add refetch logic for types as well
    }, 3000); 
    setTimeout(() => setUploadStatus(""), 5000); 
    fetchDocuments(); // Refresh documents after upload
    fetchTypes(); // Refresh types after upload
  };

  const handleFilterChange = (newFilter: Filter) => {
    setSelectedFilter(newFilter);
    // Data fetching is handled by the useEffect watching selectedFilter
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isLoadingChat) return;
    
    const newUserMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: chatInput,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Add user message immediately for responsiveness
    // Also prepare history for the AI action
    const currentMessages = [...chatMessages, newUserMessage];
    setChatMessages(currentMessages);
    setChatInput("");
    setIsLoadingChat(true);

    // Convert ChatMessage[] to CoreMessage[] for the action
    // Filter out non-string content and roles not needed by AI history
    const historyForAI: CoreMessage[] = currentMessages
      .filter(msg => typeof msg.content === 'string')
      .map(msg => {
        // Only include messages with valid roles for CoreMessage
        if (msg.role === 'user') {
          return {
            role: 'user' as const,
            content: msg.content as string,
          };
        } else if (msg.role === 'assistant') {
          return {
            role: 'assistant' as const,
            content: msg.content as string,
          };
        } else if (msg.role === 'tool') {
          return {
            role: 'tool' as const,
            content: msg.content as string,
          };
        }
        // Skip invalid roles by returning null, then filter out nulls
        return null;
      })
      .filter(Boolean) as CoreMessage[];

    try {
      // Call the new AI search action
      const result = await handleUserSearchQueryAction({
        userQuery: chatInput,
        chatHistory: historyForAI.slice(0, -1), // Send history *before* the latest user message
      });

      let assistantMessageContent: string | React.ReactNode;
      if (result.success && result.response) {
        assistantMessageContent = result.response;
      } else {
        console.error("AI Action Error:", result.error);
        assistantMessageContent = `Sorry, I encountered an error: ${result.error || 'Unknown error'}`;
      }

      const newAssistantMessage: ChatMessage = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: assistantMessageContent,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      // Add assistant response
      setChatMessages((prev) => [...prev, newAssistantMessage]);

    } catch (error) {
      console.error("Failed to call AI search action:", error);
      const errorAssistantMessage: ChatMessage = {
         id: `asst-err-${Date.now()}`,
         role: 'assistant',
         content: "Sorry, I couldn't connect to the AI service.",
         timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages((prev) => [...prev, errorAssistantMessage]);
    } finally {
      setIsLoadingChat(false);
    }
  };

  // --- Conditional Returns *AFTER* all hooks ---
  if (isAuthLoading || isTrialLoading) {
     return (
      <div className="h-screen w-full flex items-center justify-center">
         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
      </div>
    );
  }

  // --- Main Component Return --- 
  return (
    <div className="h-[100vh] max-h-[100vh] w-full flex flex-col bg-slate-50 dark:bg-[#0B1120] overflow-hidden">
      {/* Resizable panel group starts immediately */}
      <ResizablePanelGroup 
        direction={isMobile ? "vertical" : "horizontal"} 
        className="w-full h-full flex-grow overflow-hidden"
      > 
        {/* Left Sidebar - UPDATED with responsive layout */}
        <ResizablePanel 
          defaultSize={isMobile ? 25 : 20} 
          minSize={isMobile ? 20 : 15} 
          maxSize={isMobile ? 50 : 25} 
          className="bg-white dark:bg-neutral-dark border-r dark:border-slate-700 p-4 flex flex-col h-full overflow-hidden"
        >
          <div className="flex-shrink-0">
            <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2 px-2">Main</h3>
          </div>
          <nav className="flex flex-col space-y-1 overflow-y-auto flex-grow">
             <Button 
                variant={selectedFilter.type === 'special' && selectedFilter.value === 'all' ? "secondary" : "ghost"}
                className="w-full justify-start"
                onClick={() => handleFilterChange({ type: 'special', value: 'all' })}
              >
                <Inbox className="mr-3 h-5 w-5" /> All Documents
             </Button>
             <Button 
                variant={selectedFilter.type === 'special' && selectedFilter.value === 'recent' ? "secondary" : "ghost"}
                className="w-full justify-start"
                onClick={() => handleFilterChange({ type: 'special', value: 'recent' })}
             >
                <Clock className="mr-3 h-5 w-5" /> Recent
             </Button>
             <Button 
                variant={selectedFilter.type === 'special' && selectedFilter.value === 'starred' ? "secondary" : "ghost"}
                className="w-full justify-start"
                onClick={() => handleFilterChange({ type: 'special', value: 'starred' })}
                disabled // TODO: Enable when starring is implemented
             >
                <Star className="mr-3 h-5 w-5" /> Starred
             </Button>
              
              <h3 className="text-xs font-semibold text-slate-500 uppercase mt-4 mb-2 px-2">Categories</h3>
             {isLoadingTypes ? (
               <div className="px-2 space-y-2">
                 <Skeleton className="h-8 w-full" />
                 <Skeleton className="h-8 w-full" />
               </div>
             ) : availableTypes.length > 0 ? (
               availableTypes.map((type, index) => (
                  <Button 
                     key={`${type}-${index}`}
                     variant={selectedFilter.type === 'category' && selectedFilter.value === type ? "secondary" : "ghost"}
                     className="w-full justify-start capitalize"
                     onClick={() => handleFilterChange({ type: 'category', value: type })}
                  >
                     <Folder className="mr-3 h-5 w-5" /> {type || 'Uncategorized'}
                  </Button>
               ))
             ) : (
               <p className="text-xs text-slate-500 px-2">No categories found.</p>
             )}

             {/* TODO: Add Date filtering section here */}
             {/* <h3 className="text-xs font-semibold text-slate-500 uppercase mt-4 mb-2 px-2">Date</h3> ... */}
             
          </nav>
          <div className="mt-auto flex-shrink-0">
            <Link href="/profile" className="flex items-center p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300">
               <Settings className="mr-3 h-5 w-5" /> Settings
            </Link>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />

        {/* Center Content Area - UPDATED */}
        <ResizablePanel 
          defaultSize={isMobile ? 35 : 55} 
          minSize={isMobile ? 30 : 40} 
          className="flex flex-col p-3 md:p-6 overflow-hidden h-full max-h-full"
        >
          {/* --- RESTORE Integrated Upload Zone --- */}
          <div className="mb-6 p-4 md:p-6 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg bg-slate-100 dark:bg-slate-800 flex-shrink-0">
             {/* Pass user ID if needed by FileUpload, ensure handleUploadSuccess is defined */}
             <FileUpload onUploadSuccess={handleUploadSuccess} /> 
             {/* Ensure uploadStatus state is defined */}
             {uploadStatus && ( 
              <p className="mt-4 text-sm text-green-600 dark:text-green-400">
                 {uploadStatus}
              </p>
            )}
          </div>
          
          {/* Document Display Area - UPDATED with Table */}
          <h3 className="text-lg md:text-xl font-semibold mb-4 text-slate-900 dark:text-white capitalize flex-shrink-0">
             {selectedFilter.type === 'special' ? `${selectedFilter.value} Documents` : selectedFilter.value}
             {isLoadingDocuments ? "" : ` (${documents.length})`}
          </h3>
          
          {/* Scrollable Table Container - Made responsive */}
          <div className="flex-grow overflow-auto border dark:border-slate-700 rounded-md h-0 min-h-0 max-h-[calc(100%-4rem)]"> 
            <Table className="min-w-full">
              <TableHeader className="sticky top-0 bg-slate-100 dark:bg-slate-800 z-10">
                <TableRow>
                  <TableHead className="w-[40%]">Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Extracted Date</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingDocuments ? (
                  // Loading Skeletons for Table Rows
                  [...Array(8)].map((_, i) => (
                    <TableRow key={`skel-${i}`}>
                      <TableCell><Skeleton className="h-4 w-3/4" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : documents.length > 0 ? (
                  // Actual Document Rows
                  documents.map((doc) => {
                    // Use the dedicated columns instead of extracted_data
                    const docType = doc.document_type?.toLowerCase() || 'file';
                    const docDateStr = doc.document_date || null;
                    const uploadedDateStr = doc.uploaded_at;
                    
                    // Get a friendly name for the document
                    const docName = doc.original_filename || doc.file_path.split('/').pop() || 'Document'; 

                    return (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium truncate" title={docName}>{docName}</TableCell>
                        <TableCell>
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full text-xs capitalize">
                            {docType}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                          {docDateStr ? new Date(docDateStr).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                          {uploadedDateStr ? new Date(uploadedDateStr).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" asChild>
                             <a href={doc.document_url} target="_blank" rel="noopener noreferrer">Preview</a>
                          </Button>
                          {/* Add more actions later (e.g., Delete, Details) */}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  // Empty State Row
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-slate-500 dark:text-slate-400">
                       <FileText size={30} className="mx-auto mb-2"/>
                       No documents found matching this filter.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div> 
        </ResizablePanel>
        <ResizableHandle withHandle />

        {/* Right Chat Panel - Chat container needs improvements */}
        <ResizablePanel 
          defaultSize={isMobile ? 40 : 25} 
          minSize={isMobile ? 25 : 20} 
          maxSize={isMobile ? 60 : 35} 
          className="bg-white dark:bg-neutral-dark border-l dark:border-slate-700 flex flex-col h-full max-h-full overflow-hidden"
        >
          {/* Header (stays the same) */}
          <div className="p-4 border-b dark:border-slate-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Document Assistant</h2>
          </div>

          {/* Chat Messages Container - IMPROVED SCROLLING */}
          <div 
            ref={chatContainerRef}
            className="flex-grow overflow-y-auto p-4 space-y-4 h-0 min-h-0"
          >
            {chatMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 dark:text-slate-400 space-y-3">
                <MessageSquare className="h-12 w-12" />
                <div>
                  <p className="font-medium">No messages yet</p>
                  <p className="text-sm">Ask about your documents below</p>
                </div>
              </div>
            ) : (
              chatMessages.map((message, index) => (
                <div 
                  key={index} 
                  className={`flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div 
                    className={`max-w-[85%] px-4 py-2 rounded-lg ${
                      message.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 dark:text-white'
                    }`}
                  >
                    <ReactMarkdown
                      className="prose dark:prose-invert max-w-none"
                      remarkPlugins={[remarkGfm]}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                </div>
              ))
            )}
            {isLoadingChat && (
              <div className="flex justify-start">
                <div className="bg-slate-200 dark:bg-slate-700 max-w-[85%] px-4 py-2 rounded-lg dark:text-white">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              </div>
            )}
          </div>

          {/* Input Section - IMPROVED FOR MOBILE */}
          <div className="p-3 md:p-4 border-t dark:border-slate-700">
            <form onSubmit={handleSendMessage} className="flex flex-col md:flex-row gap-2">
              <Textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about your documents..."
                className="flex-grow min-h-[60px] max-h-[120px]"
              />
              <Button 
                type="submit" 
                disabled={isLoadingChat || chatInput.trim() === ''} 
                className="md:self-end"
              >
                {isLoadingChat ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span className="ml-2 md:hidden">Send</span>
              </Button>
            </form>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

// --- Database Function (Example) ---
/* 
Add this function in your Supabase SQL Editor if you prefer RPC over direct select:

CREATE OR REPLACE FUNCTION get_distinct_document_types(user_id_param uuid)
RETURNS TABLE(document_type text)
LANGUAGE sql
STABLE -- Indicates the function doesn't modify the database
AS $$
  SELECT DISTINCT LTRIM(RTRIM(extracted_data->>'type')) AS document_type 
  FROM public.documents
  WHERE uploaded_by = user_id_param
  AND jsonb_typeof(extracted_data->'type') = 'string' -- Ensure it's a string
  AND extracted_data->>'type' IS NOT NULL
  AND LTRIM(RTRIM(extracted_data->>'type')) <> ''; -- Ensure it's not empty/whitespace
$$;

*/