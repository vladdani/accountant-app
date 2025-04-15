"use client";

// import { useWebSocket } from '@/contexts/WebSocketContext';
import React, { useEffect, useState, useRef } from 'react';
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
  // Loader2, // Commented out as it might be used implicitly by Skeleton
  FileText, // Generic document icon
  // Calendar // Commented out, will be used for date filtering later
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
import { ScrollArea } from "@/components/ui/scroll-area"; 
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

// --- Types ---
interface Document {
  id: string;
  file_path: string; // Path in storage
  document_url: string; // Public URL
  uploaded_at: string;
  extracted_data: Record<string, unknown> | null;
  original_filename: string | null;
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

  // --- Data Fetching useEffects ---

  // Fetch distinct document types for the sidebar
  useEffect(() => {
    if (!user?.id) return;

    const fetchTypes = async () => {
      setIsLoadingTypes(true);
      try {
        const { data, error } = await supabase
          .rpc('get_distinct_document_types', { user_id_param: user.id }); 
          // Assumes a DB function `get_distinct_document_types` exists
          // RPC function returns: TABLE(document_type text)
          // So data is like: [{ document_type: 'invoice' }, { document_type: 'receipt' }]

        if (error) throw error;
        
        // FIX: Extract the 'document_type' string from each object in the array
        const typesArray = data?.map((item: { document_type: string }) => item.document_type).filter(Boolean) ?? [];
        
        setAvailableTypes(typesArray as string[]); // Now availableTypes is string[]
      } catch (error) {
        console.error("Error fetching document types:", error);
        setAvailableTypes([]); // Set empty on error
      } finally {
        setIsLoadingTypes(false);
      }
    };

    fetchTypes();
  }, [user?.id]);

  // Fetch documents based on the selected filter
  useEffect(() => {
    if (!user?.id) return;

    const fetchDocuments = async () => {
      setIsLoadingDocuments(true);
      let query = supabase
        .from('documents')
        .select('id, file_path, document_url, uploaded_at, extracted_data, original_filename')
        .eq('uploaded_by', user.id);

      // Apply filter logic
      if (selectedFilter.type === 'category') {
        query = query.eq('extracted_data->>type', selectedFilter.value);
      } else if (selectedFilter.type === 'date') {
        // TODO: Implement date filtering logic (e.g., year-month)
        // const [year, month] = selectedFilter.value.split('-'); // Commented out unused variables
        // query = query.gte('uploaded_at', `${year}-${month}-01T00:00:00Z`)
        //              .lt('uploaded_at', `${year}-${month + 1}-01T00:00:00Z`); // Adjust month logic
      } else if (selectedFilter.type === 'special') {
        if (selectedFilter.value === 'recent') {
          query = query.order('uploaded_at', { ascending: false }).limit(20);
        } else if (selectedFilter.value === 'starred') {
          // TODO: Add is_starred column or similar logic
          // query = query.eq('is_starred', true);
        } else { // 'all'
          query = query.order('uploaded_at', { ascending: false });
        }
      } else { // Default to all
         query = query.order('uploaded_at', { ascending: false });
      }

      try {
        const { data, error } = await query;
        if (error) throw error;
        setDocuments(data || []);
      } catch (error) {
        console.error(`Error fetching documents for filter ${selectedFilter.value}:`, error);
        setDocuments([]);
      } finally {
        setIsLoadingDocuments(false);
      }
    };

    fetchDocuments();
  }, [user?.id, selectedFilter]);

  // --- Other useEffects (Auth, Subscription, Onboarding Checks) --- 

  // Combine initial fetch/refresh and onboarding check
  useEffect(() => {
    if (user?.id) {
      console.log("Dashboard mounted/user changed, forcing subscription fetch.");
      fetchSubscription(); 
      
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
    console.log("Checking access permissions...", { user: !!user, status: subscription?.status, isInTrial });
    // Restore hasValidSubscription check
    const hasValidSubscription = subscription && ['active', 'trialing'].includes(subscription.status);

    // --- START: REMOVE TEMPORARY WORKAROUND --- 
    /* 
    console.warn("WORKAROUND ACTIVE: Dashboard access granted regardless of subscription/trial status.");
    if (!user) { // Still redirect if not logged in
        console.log(`Redirecting to /login. Reason: No user`);
        router.replace('/login'); 
    }
    */
    // --- Restore Original Check ---
    // If user data is loaded but user is invalid OR no valid subscription/trial, redirect.
    if (!user || (!hasValidSubscription && !isInTrial)) {
        console.log(`Redirecting to /profile. Reason: ${!user ? 'No user' : 'No valid sub or trial'}`);
        router.replace('/profile');
    } else {
        // No need to set hasCheckedSubscription anymore
        console.log("User has access to dashboard.");
    }
    // --- END: REMOVE TEMPORARY WORKAROUND ---

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

  const handleSendMessage = async () => {
    const trimmedInput = chatInput.trim();
    if (!trimmedInput || isLoadingChat) return;

    const newUserMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmedInput,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Add user message immediately for responsiveness
    // Also prepare history for the AI action
    const currentMessages = [...chatMessages, newUserMessage];
    setChatMessages(currentMessages);
    setChatInput("");
    setIsLoadingChat(true);

    // Convert ChatMessage[] to CoreMessage[] for the action
    // Filter out non-string/element content and roles not needed by AI history
    const historyForAI: CoreMessage[] = currentMessages
      .filter(msg => typeof msg.content === 'string' && (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'tool'))
      .map(msg => ({ 
          role: msg.role,
          content: msg.content as string, // Cast assumes string content
          // Include tool info if your ChatMessage stores it and CoreMessage needs it
      }));

    try {
      // Call the new AI search action
      const result = await handleUserSearchQueryAction({
        userQuery: trimmedInput,
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

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  // --- Conditional Returns *AFTER* all hooks ---
  if (isAuthLoading || isTrialLoading) {
     return (
      <div className="min-h-screen flex items-center justify-center">
         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
      </div>
    );
  }

  // --- Main Component Return --- 
  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-[#0B1120] overflow-hidden">
       {/* SINGLE Top Header - REMOVED */}
       {/* 
       <header className="flex items-center justify-between p-4 border-b dark:border-slate-700 bg-white dark:bg-neutral-dark sticky top-0 z-10">
         <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-md flex items-center justify-center">
                <Inbox size={18} className="text-slate-600 dark:text-slate-300"/>
             </div>
             <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Digital Storage</h1> 
         </div>
         <div className="flex items-center space-x-4">
            <span className="text-xs font-medium px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded">
                {isInTrial ? "Trial Period" : (subscription?.status ? subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1) : "No Plan")}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                 <Avatar className="h-8 w-8 cursor-pointer">
                   <AvatarFallback className="bg-primary text-primary-foreground">
                       {user?.email?.charAt(0).toUpperCase() ?? 'V'}
                   </AvatarFallback>
                 </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
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
         </div>
       </header>
       */}

      {/* Resizable panel group starts immediately */}
      {/* Ensure the parent div takes full height if header is removed */}
      <ResizablePanelGroup direction="horizontal" className="flex-grow border-t dark:border-slate-700"> {/* Added border-t */}
        {/* Left Sidebar - UPDATED */}
        <ResizablePanel defaultSize={20} minSize={15} maxSize={25} className="bg-white dark:bg-neutral-dark border-r dark:border-slate-700 p-4 flex flex-col">
           {/* --- REMOVE Upload Button/Component from Sidebar --- */}
           {/*
           <FileUpload userId={user?.id} onUploadSuccess={handleUploadSuccess}>
             <Button className="w-full mb-6">
               <Upload className="mr-2 h-4 w-4" /> Upload Document
            </Button>
          </FileUpload>
          */}
          <nav className="flex flex-col space-y-1 overflow-y-auto">
             <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2 px-2">Main</h3>
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
          <div className="mt-auto">
            <Link href="/profile" className="flex items-center p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300">
               <Settings className="mr-3 h-5 w-5" /> Settings
            </Link>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />

        {/* Center Content Area - UPDATED with Table */}
        <ResizablePanel defaultSize={55} minSize={40} className="flex flex-col p-6 overflow-hidden">
          {/* --- RESTORE Integrated Upload Zone --- */}
          <div className="mb-8 p-6 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg bg-slate-100 dark:bg-slate-800">
             {/* Pass user ID if needed by FileUpload, ensure handleUploadSuccess is defined */}
             <FileUpload onUploadSuccess={handleUploadSuccess} /> 
             {/* Ensure uploadStatus state is defined */}
             {uploadStatus && ( 
              <p className="mt-4 text-sm text-green-600 dark:text-green-400">
                 {uploadStatus}
              </p>
            )}
          </div>
          {/* --- End RESTORE --- */}
          
          {/* Document Display Area - UPDATED with Table */}
          <h3 className="text-xl font-semibold mb-4 text-slate-900 dark:text-white capitalize flex-shrink-0">
             {selectedFilter.type === 'special' ? `${selectedFilter.value} Documents` : selectedFilter.value}
             {isLoadingDocuments ? "" : ` (${documents.length})`}
          </h3>
          
          {/* Scrollable Table Container */}
          <div className="flex-grow overflow-y-auto border dark:border-slate-700 rounded-md"> 
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
                    const data = doc.extracted_data;
                    const docType = (data?.type as string)?.toLowerCase() || 'file';
                    const docDateStr = data?.date as string || null; // Use null if no extracted date
                    const uploadedDateStr = doc.uploaded_at;
                    
                    let friendlyName = '';
                    if (data && typeof data === 'object') {
                      // Simplified naming for table view - prioritize original name or derived type/supplier
                      const supplier = typeof data.supplier === 'string' && data.supplier.trim() ? data.supplier.trim() : null;
                      const type = typeof data.type === 'string' && data.type.trim() ? data.type.trim() : null;
                      friendlyName = doc.original_filename || (supplier && type ? `${supplier} - ${type}` : type || supplier || '');
                    }
                    const docName = friendlyName || doc.original_filename || doc.file_path.split('/').pop() || 'Document'; 

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

        {/* Right Chat Panel - Updated Structure */}
        <ResizablePanel defaultSize={25} minSize={20} maxSize={35} className="bg-white dark:bg-neutral-dark border-l dark:border-slate-700 flex flex-col"> {/* Remove p-4 */}          
          {/* Header (stays the same) */}
          <div className="p-4 flex-shrink-0"> {/* Add padding back here */}
            <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">Semantic Search</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Ask questions about your documents in natural language.
            </p>
          </div>
          
          {/* Scrollable Message Area (Takes up remaining space) */}
          <ScrollArea className="flex-grow p-4 space-y-4 bg-slate-50 dark:bg-slate-800 border-t border-b dark:border-slate-700" ref={chatContainerRef}> {/* Add borders and background */}
            {chatMessages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`p-3 rounded-lg max-w-[80%] ${message.role === 'user' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                }`}>
                  {/* Render JSX content directly */} 
                  {typeof message.content === 'string' ? (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p> 
                  ) : ( 
                    message.content
                  )}
                  <div className={`text-xs mt-1 ${message.role === 'user' ? 'text-primary-foreground/80' : 'text-slate-500 dark:text-slate-400'} text-right`}>{message.timestamp}</div>
                </div>
              </div>
            ))}
             {/* Loading Indicator */}
             {isLoadingChat && (
               <div className="flex justify-start">
                  <div className="p-3 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                    <Skeleton className="h-4 w-20" />
                  </div>
               </div>
             )}
          </ScrollArea>
          
          {/* Input Area (Fixed at the bottom) */}
          <div className="p-4 border-t dark:border-slate-700 flex items-center flex-shrink-0"> {/* Add flex-shrink-0 */} 
             <input 
               type="text" 
               placeholder="Ask a question..." 
               className="flex-grow p-2 border rounded-l-md focus:outline-none focus:ring-1 focus:ring-primary dark:bg-slate-700 dark:border-slate-600 dark:text-white disabled:opacity-50"
               value={chatInput}
               onChange={(e) => setChatInput(e.target.value)}
               onKeyDown={handleKeyDown} // Handle Enter key
               disabled={isLoadingChat}
             />
             <Button 
               className="rounded-l-none disabled:opacity-50"
               onClick={handleSendMessage}
               disabled={isLoadingChat || !chatInput.trim()}
             >
                Send
             </Button>
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