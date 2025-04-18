"use client";

// import { useWebSocket } from '@/contexts/WebSocketContext';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';
// import { PostgrestError } from '@supabase/supabase-js';
import { cn } from '@/lib/utils'; // Import cn utility

// import { useRouter } from 'next/navigation';
// import { useSubscription } from '@/hooks/useSubscription';
// import { OnboardingTour } from '@/components/OnboardingTour';
// import { useTrialStatus } from '@/hooks/useTrialStatus';
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
  Menu,
} from 'lucide-react';
// import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
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

// Import new sidebar components
// Remove unused SidebarLink import
import { Sidebar, SidebarBody /*, SidebarLink */ } from "@/components/ui/sidebar";

// --- Types ---
interface Document {
  id: string;
  file_path: string; // Path in storage
  document_url: string; // Public URL
  uploaded_at: string;
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
  // const router = useRouter();
  // const { subscription, isLoading: isSubLoading, fetchSubscription } = useSubscription();
  // const { isInTrial, isLoading: isTrialLoading } = useTrialStatus();
  const [uploadStatus, setUploadStatus] = useState<string>(""); 
  // const [isMobile, setIsMobile] = useState<boolean>(false);
  
  // State for document display and filtering
  const [documents, setDocuments] = useState<Document[]>([]); // Use the updated Document interface
  const [isLoadingDocuments, setIsLoadingDocuments] = useState<boolean>(true);
  const [selectedFilter, setSelectedFilter] = useState<Filter>({ type: 'special', value: 'all' });
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [isLoadingTypes, setIsLoadingTypes] = useState<boolean>(true);
  const [processingDocId, setProcessingDocId] = useState<string | null>(null); // State for AI processing
  // TODO: Add state for available dates (years/months) later
  const [documentCount, setDocumentCount] = useState<number>(0); // State for document count
  const [isLoadingCount, setIsLoadingCount] = useState(true); // Loading state for count

  // State for chat
  const chatLocalStorageKey = user ? `chatHistory-${user.id}` : null; // Key for localStorage
  const [chatInput, setChatInput] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]); // Initialize empty
  const [isLoadingChat, setIsLoadingChat] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false); // State for mobile sidebar
  const [mobileView, setMobileView] = useState<'chat' | 'documents'>('chat'); // State for mobile view ('chat' or 'documents')
  const chatContainerRef = useRef<HTMLDivElement>(null); 

  // --- Helper Functions for Data Fetching ---
  const fetchTypes = useCallback(async () => {
    if (!user?.id) return;
    
    console.log("Starting fetchTypes for user:", user.id);
    setIsLoadingTypes(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('document_type')
        .eq('uploaded_by', user.id)
        .not('document_type', 'is', null);

      console.log("Types fetch raw result:", { data, error, userId: user.id }); // Log raw result

      if (error) {
         console.error("!!! Error explicitly thrown during fetchTypes:", error); // Add explicit log
         throw error;
      }
      
      const typesSet = new Set(data.map(item => item.document_type));
      const typesArray = Array.from(typesSet);
      
      console.log("Processed document types:", typesArray);
      setAvailableTypes(typesArray);
    } catch (error) {
      // Add more detail to catch log
      console.error("!!! CATCH block hit in fetchTypes:", error instanceof Error ? error.message : error);
      setAvailableTypes([]); 
    } finally {
      console.log("Finished fetchTypes, setting loading false."); // Log finally
      setIsLoadingTypes(false);
    }
  }, [user?.id]);

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
      console.log("Executing Supabase documents query...");
      const { data, error } = await query;
       // Log raw result before processing
      console.log("Documents query raw result:", { 
        count: data?.length || 0, 
        error 
      });
      
      // Log full data in development only
      if (process.env.NODE_ENV === 'development') {
        console.log("Full documents data:", data);
      }
      
      if (error) {
           console.error("!!! Error explicitly thrown during fetchDocuments:", error); // Add explicit log
           throw error;
      }
      setDocuments(data || []);
    } catch (error) {
      // Add more detail to catch log
      console.error(`!!! CATCH block hit in fetchDocuments for filter ${selectedFilter.value}:`, error instanceof Error ? error.message : error);
      setDocuments([]);
    } finally {
      console.log("Finished fetchDocuments, setting loading false."); // Log finally
      setIsLoadingDocuments(false);
    }
  }, [user?.id, selectedFilter]);

  // Function to fetch document count
  const fetchDocumentCount = useCallback(async () => {
    if (!user?.id || !supabase) return;
    console.log('[fetchDocumentCount] Starting fetch...');
    setIsLoadingCount(true);
    try {
      const { count, error } = await supabase
        .from('documents')
        .select('*' , { count: 'exact', head: true })
        .eq('uploaded_by', user.id);

      if (error) throw error;

      console.log(`[fetchDocumentCount] Raw result: count=${count}`);
      setDocumentCount(count ?? 0);
    } catch (error) {
      console.error('Error fetching document count:', error);
      setDocumentCount(0); // Default to 0 on error
    } finally {
      setIsLoadingCount(false);
    }
  }, [user?.id, supabase]);

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

  // Initial data fetch and filter application
  useEffect(() => {
    if (user?.id && supabase) {
      fetchTypes();
      fetchDocumentCount(); // Fetch count on initial load/user change
      // Initial fetch based on default filter
      fetchDocuments(); // Call without argument
    }
    // Add fetchDocumentCount to dependencies
  }, [user?.id, supabase, fetchDocuments, fetchTypes, fetchDocumentCount, selectedFilter]);

  // Realtime listener for document changes
  useEffect(() => {
    if (!processingDocId || !supabase) return;

    console.log(`Setting up Realtime listener for document ID: ${processingDocId}`);

    const channel = supabase.channel(`doc-update-${processingDocId}`)
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'documents', 
          filter: `id=eq.${processingDocId}` 
        },
        (payload) => {
          console.log('Realtime UPDATE received for document:', payload.new.id);
          setUploadStatus("AI Processing complete! Refreshing list...");
          // Refresh data using the current filter (implicitly via dependency)
          fetchDocuments(); // Call without argument
          fetchTypes();
          fetchDocumentCount();
          setProcessingDocId(null);
          setTimeout(() => setUploadStatus(""), 3000);
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Realtime channel SUBSCRIBED for doc ${processingDocId}`);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`Realtime channel error for doc ${processingDocId}:`, status, err);
           setUploadStatus("Error listening for updates. Refresh manually.");
           setProcessingDocId(null); 
        }
      });

    return () => {
      if (channel) {
        console.log(`Cleaning up Realtime channel for doc ${processingDocId}`);
        supabase.removeChannel(channel).catch(error => {
             console.error("Error removing realtime channel:", error);
        });
      }
    };
    // Ensure dependencies are correct for this single listener
  }, [processingDocId, supabase, fetchDocuments, fetchTypes, fetchDocumentCount, selectedFilter]); 

  // Load chat history from localStorage on mount
  useEffect(() => {
    if (!chatLocalStorageKey) return; // Only run if user is loaded

    const storedHistory = localStorage.getItem(chatLocalStorageKey);
    if (storedHistory) {
      try {
        const parsedHistory = JSON.parse(storedHistory);
        // Basic validation
        if (Array.isArray(parsedHistory) && parsedHistory.length > 0) {
          setChatMessages(parsedHistory);
          console.log('[Chat Persistence] Loaded history from localStorage');
          return; // Exit if history loaded
        } else {
          console.warn('[Chat Persistence] Invalid history in localStorage');
        }
      } catch (error) {
        console.error('[Chat Persistence] Error parsing localStorage history:', error);
        localStorage.removeItem(chatLocalStorageKey); // Clear invalid entry
      }
    }

    // Set initial message if no valid history was loaded
    console.log('[Chat Persistence] Setting initial message.');
    setChatMessages([
      {
        id: `asst-init-${Date.now()}`,
        role: 'assistant',
        content: "Hi! I'm your document assistant. How can I help you search through your documents today?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  }, [chatLocalStorageKey]); // Depend on the key (which depends on user)

  // Save chat history to localStorage whenever it changes
  useEffect(() => {
    if (!chatLocalStorageKey || chatMessages.length === 0) return;

    // Avoid saving if it only contains the single initial message?
    // Or save regardless? Let's save regardless for now.
    // Consider adding a check like: 
    // if (chatMessages.length === 1 && chatMessages[0].id.startsWith('asst-init-')) return;

    try {
      localStorage.setItem(chatLocalStorageKey, JSON.stringify(chatMessages));
      // console.log('[Chat Persistence] Saved history to localStorage'); // Optional logging
    } catch (error) {
      console.error('[Chat Persistence] Error saving history to localStorage:', error);
    }
  }, [chatMessages, chatLocalStorageKey]); // Depend on messages and key

  // Scroll chat useEffect 
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // --- Helper Functions --- 
  const handleUploadSuccess = (result: { 
    success: boolean; 
    url?: string; 
    dbRecordId?: string; // Expect dbRecordId on success
    error?: string; 
    duplicateOf?: { id: string; name: string | null };
  }) => {
    if (result.success && result.dbRecordId) {
      console.log("Upload successful, initiating AI processing for:", result.dbRecordId);
      // Set status and track the ID for Realtime listener
      setUploadStatus(`File uploaded. Processing with AI...`); 
      setProcessingDocId(result.dbRecordId);
      // REMOVE immediate refresh calls
      // fetchDocuments();
      // fetchTypes();
      // Clear status message after a longer delay, processing might take time
      setTimeout(() => setUploadStatus(""), 10000); 
    } else if (result.duplicateOf) {
      console.warn("Duplicate file detected:", result.duplicateOf);
      const duplicateName = result.duplicateOf.name || 'an existing document';
      // Slightly more informative message
      setUploadStatus(`Duplicate: File already exists named '${duplicateName}'.`); 
      setTimeout(() => setUploadStatus(""), 7000); 
    } else {
      console.error("Upload failed on dashboard:", result.error);
      setUploadStatus(`Error: ${result.error || 'Failed to upload file. Check console.'}`);
      setTimeout(() => setUploadStatus(""), 7000);
    }
  };

  const handleFilterChange = (newFilter: Filter) => {
    setSelectedFilter(newFilter);
    // Data fetching is handled by the useEffect watching selectedFilter

    // On mobile screens (heuristic check, adjust breakpoint if needed)
    if (window.innerWidth < 768) { 
      setMobileView('documents'); // Switch to documents view
    }
    setIsMobileSidebarOpen(false); // Always close sidebar after selection
  };

  const handleSendMessage = async (e: React.FormEvent) => {
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
  if (isAuthLoading /*|| isTrialLoading*/) {
     return (
      <div className="h-screen w-full flex items-center justify-center">
         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
      </div>
    );
  }

  // --- Sidebar Links Definition ---
  const sidebarLinks = [
    {
      label: `All Documents ${isLoadingCount ? '' : `(${documentCount})`}`,
      href: "#", // Placeholder, actual filtering handled by onClick
      icon: isLoadingCount ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <Inbox className="mr-3 h-5 w-5" />,
      filter: { type: 'special', value: 'all' } as Filter
    },
    {
      label: "Recent",
      href: "#",
      icon: <Clock className="mr-3 h-5 w-5" />,
      filter: { type: 'special', value: 'recent' } as Filter
    },
    {
      label: "Starred",
      href: "#",
      icon: <Star className="mr-3 h-5 w-5" />,
      filter: { type: 'special', value: 'starred' } as Filter,
      disabled: true // Keep disabled for now
    },
  ];

  const categoryLinks = isLoadingTypes ? [] : availableTypes.map((type) => ({
      label: type || 'Uncategorized',
      href: "#",
      icon: <Folder className="mr-3 h-5 w-5" />,
      filter: { type: 'category', value: type } as Filter
  }));

  // --- Main Component Return ---
  return (
    // Use flex row layout ON MEDIUM SCREENS AND UP, full screen height, prevent body scroll
    <div className="flex flex-row h-screen w-screen overflow-hidden bg-slate-50 dark:bg-[#0B1120] relative">

      {/* Overlay for mobile sidebar */} 
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)} 
        />
      )}

      {/* === START NEW SIDEBAR === */}
      {/* Sidebar manages its own width and transition */}
      <div className={cn(
         "fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-[#0B1120] transition-transform duration-300 ease-in-out md:static md:flex md:flex-shrink-0 md:translate-x-0",
         isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full" 
      )}> 
        <Sidebar> 
          <SidebarBody className="justify-between gap-10 px-0 py-4 border-r dark:border-slate-700"> {/* Add border */} 
             {/* ... existing sidebar content (Main links, Categories, Settings) ... */}
               <div className="flex flex-col flex-1 overflow-y-auto px-4"> {/* Inner scrollable area */} 
                  {/* Using Buttons for links to maintain style/click handling */} 
                  <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">Main</h3>
                  {sidebarLinks.map((link, idx) => (
                     <Button
                         key={`link-${idx}`}
                         variant={selectedFilter.type === link.filter.type && selectedFilter.value === link.filter.value ? "secondary" : "ghost"}
                         className="w-full justify-start gap-2"
                         onClick={() => !link.disabled && handleFilterChange(link.filter)}
                         disabled={link.disabled}
                     >
                        {link.icon}
                        {link.label}
                     </Button>
                  ))}
                  <h3 className="text-xs font-semibold text-slate-500 uppercase mt-4 mb-2">Categories</h3>
                  {isLoadingTypes ? (
                     <div className="space-y-2">
                       <Skeleton className="h-8 w-full" />
                       <Skeleton className="h-8 w-full" />
                     </div>
                  ) : categoryLinks.length > 0 ? (
                    categoryLinks.map((link, idx) => (
                      <Button 
                         key={`cat-${idx}`}
                         variant={selectedFilter.type === link.filter.type && selectedFilter.value === link.filter.value ? "secondary" : "ghost"}
                         className="w-full justify-start gap-2 capitalize"
                         onClick={() => handleFilterChange(link.filter)}
                      >
                         {link.icon} {link.label}
                      </Button>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500">No categories found.</p>
                  )}
                  {/* TODO: Date Filter section could go here */} 
               </div>
               {/* Bottom Section (e.g., Settings) */} 
               <div className="mt-auto flex-shrink-0 px-4 pb-4"> {/* Add padding */} 
                  <Link href="/profile" className="flex items-center p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300">
                     <Settings className="mr-3 h-5 w-5" /> Settings
                  </Link>
               </div>
            </SidebarBody>
          </Sidebar>
      </div>
      {/* === END NEW SIDEBAR === */}

      {/* Center Content Area - Takes up remaining space */}
      {/* Hide Center Content on small screens, show as flex-1 on medium+ */}
      <div className={cn(
         "flex-col overflow-hidden h-full max-h-full", // Basic structure
         mobileView === 'documents' ? 'flex w-full' : 'hidden', // Mobile visibility
         "md:flex md:flex-1 md:w-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6" // Desktop layout & padding
       )}> 

         {/* Header for Center Content Area - with Mobile Controls */} 
         <div className="flex items-center border-b dark:border-slate-700 pb-2 mb-2 md:mb-4 flex-shrink-0">
            {/* Hamburger Menu Button - Only on mobile */} 
            <div className="md:hidden"> {/* Wrapper for mobile */} 
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMobileSidebarOpen(true)}
              >
                <Menu className="h-6 w-6" />
                <span className="sr-only">Open menu</span>
              </Button>
            </div>

            {/* Title - centered on mobile, left-aligned on desktop */} 
            <h3 className="text-lg md:text-xl font-semibold text-slate-900 dark:text-white capitalize text-center flex-1 md:text-left">
               {/* Dynamic title based on filter */} 
               {selectedFilter.type === 'special' ? `Document Explorer - ${selectedFilter.value}` : `Document Explorer - ${selectedFilter.value}`}
               {isLoadingDocuments ? "" : ` (${documents.length})`}
            </h3>

            {/* Switch to Chat Button - Only on mobile */} 
            <div className="md:hidden"> {/* Wrapper for mobile */} 
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileView('chat')}
              >
                <MessageSquare className="h-6 w-6" />
                <span className="sr-only">Switch to Chat</span>
              </Button>
            </div>
         </div>

         {/* Upload Zone - Adjust top margin/padding if needed after container padding */}
         <div className="p-4 md:p-6 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg bg-slate-100 dark:bg-slate-800 flex-shrink-0 mb-4">
            <FileUpload onUploadComplete={handleUploadSuccess} /> 
            {uploadStatus && ( 
             <p className={`mt-4 text-sm font-medium ${uploadStatus.startsWith('File already exists') ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}`}>
                {uploadStatus}
             </p>
           )}
          </div>
        
        {/* Document Display Area */} 
        <div className="flex-grow overflow-auto border dark:border-slate-700 rounded-md h-0 min-h-0"> 
          <Table className="min-w-full">
            <TableHeader className="sticky top-0 bg-slate-100 dark:bg-slate-800 z-10">
              <TableRow>
                <TableHead className="w-[40%]">Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingDocuments ? (
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
                 documents.map((doc) => {
                   const docType = doc.document_type?.toLowerCase() || 'file';
                   const docDateStr = doc.document_date || null;
                   const uploadedDateStr = doc.uploaded_at;
                   const docName = doc.original_filename || doc.file_path.split('/').pop() || 'Document'; 

                   return (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium truncate max-w-0" title={docName}>{docName}</TableCell>
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
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
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
      </div>

      {/* Right Chat Panel - Full width on mobile, fixed width on medium+ */}
      {/* Ensure it takes full height and handles overflow */} 
      {/* Mobile: Show based on mobileView state. Desktop: Always show fixed width */}
      <div className={cn(
         "bg-white dark:bg-neutral-dark flex flex-col h-full max-h-full overflow-hidden", // Basic structure
         mobileView === 'chat' ? 'flex w-full' : 'hidden', // Mobile visibility
         "md:flex md:w-[400px] md:flex-shrink-0 md:border-l dark:border-slate-700 px-4 sm:px-6 lg:px-8 py-4 md:py-6" // Desktop layout & padding
      )}>
         {/* Chat Header */} 
         <div className="flex items-center border-b dark:border-slate-700 pb-2 flex-shrink-0">
            {/* Hamburger Menu Button - Only on mobile */} 
            <div className="md:hidden"> {/* Wrapper for mobile */} 
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMobileSidebarOpen(true)}
              >
                <Menu className="h-6 w-6" />
                <span className="sr-only">Open menu</span>
              </Button>
            </div>

            {/* Center the title when menu button is present */} 
            <h2 className="text-lg font-semibold text-center flex-1 md:text-left">Document Assistant</h2>
            
            {/* Placeholder div for mobile layout consistency (to balance menu button) */} 
            <div className="md:hidden w-10"></div> {/* Adjust width to match button size if needed */} 
         </div>

         {/* Chat Messages Container - Remove padding if container has it */}
         <div 
             ref={chatContainerRef}
             className="flex-grow overflow-y-auto space-y-4 h-0 min-h-0 pt-4"
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
                   className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                   <div 
                     className={`max-w-[85%] px-4 py-2 rounded-lg ${message.role === 'user'? 'bg-blue-500 text-white': 'bg-slate-200 dark:bg-slate-700 dark:text-white'}`}>
                     <div className="prose dark:prose-invert max-w-none">
                       <ReactMarkdown remarkPlugins={[remarkGfm]}>
                         {typeof message.content === 'string' ? message.content : String(message.content)}
                       </ReactMarkdown>
                     </div>
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
           
         {/* Input Section - Should now be visible */} 
         <div className="border-t dark:border-slate-700 pt-4">
           <form onSubmit={handleSendMessage} className="flex flex-col md:flex-row gap-2">
             <Textarea
               value={chatInput}
               onChange={(e) => setChatInput(e.target.value)}
               placeholder="Ask about your documents..."
               className="flex-grow min-h-[60px] max-h-[120px]"
               onKeyDown={(e) => {
                 // Check if Enter is pressed without Shift
                 if (e.key === 'Enter' && !e.shiftKey) {
                   e.preventDefault(); // Prevent newline
                   // Check if input is not empty and not loading before sending
                   if (chatInput.trim() && !isLoadingChat) {
                     handleSendMessage(e as unknown as React.FormEvent); // Call submit handler
                   }
                 }
               }}
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
       </div>
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