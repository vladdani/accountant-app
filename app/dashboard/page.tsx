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
  Settings,
  Clock,
  Folder,
  Star,
  Inbox,
  FileText,
  MessageSquare,
  Send,
  Loader2,
  Menu,
  Plus,
  Home,
  Building2,
  ExternalLink,
  Download,
  X,
  Trash2,
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

// Add Dialog components from shadcn/ui
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Import new components
import { AiSearch } from '@/app/components/AiSearch';

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
  vendor?: string | null; // Changed from vendor_name to vendor
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
  type: 'special' | 'category' | 'date' | 'path'; // Add 'path' type for virtual file system
  value: string; // e.g., 'all', 'invoice', '2024-03', or '/2024/03/Booking.com'
}

// Interface for virtual file system
interface FileNode {
  name: string;
  type: 'folder' | 'vendor';
  children: FileNode[];
  documents?: Document[];
  path: string; // Full path to this node (for navigation)
}

// --- End Types ---

// --- Helper Function for Filename Generation ---
function generateDisplayFilename(doc: Document): string {
  const originalFilename = doc.original_filename || doc.file_path?.split('/').pop() || 'Document';
  const extensionMatch = originalFilename.match(/\.(\w+)$/);
  const extension = extensionMatch ? extensionMatch[0] : ''; // e.g., '.pdf'

  // Try to get components for the ideal name
  const datePart = doc.document_date 
    ? new Date(doc.document_date).toISOString().split('T')[0] // Format YYYY-MM-DD
    : null;
  const vendorPart = doc.vendor ? doc.vendor.replace(/[/\\?%*:|"<>]/g, '-') : null; // Changed from vendor_name to vendor
  const typePart = doc.document_type ? doc.document_type.replace(/[/\\?%*:|"<>]/g, '-') : null; // Sanitize type

  let filename = '';

  // Ideal: Date - Vendor - Type
  if (datePart && vendorPart && typePart) {
    filename = `${datePart} - ${vendorPart} - ${typePart}`;
  } 
  // Fallback 1: Date - Type
  else if (datePart && typePart) {
    filename = `${datePart} - ${typePart}`;
  }
  // Fallback 2: Vendor - Type
  else if (vendorPart && typePart) {
    filename = `${vendorPart} - ${typePart}`;
  }
  // Fallback 3: Type - Original Name (Truncated)
  else if (typePart) {
    const nameWithoutExt = originalFilename.replace(/\.\w+$/, '');
    filename = `${typePart} - ${nameWithoutExt.substring(0, 20)}${nameWithoutExt.length > 20 ? '...' : ''}`;
  }
  // Fallback 4: Original Name (or default)
  else {
    filename = originalFilename.replace(/\.\w+$/, ''); // Name without extension
  }

  // Ensure filename isn't empty and append extension
  return (filename || 'Document') + extension;
}

// --- End Helper --- 

export default function Dashboard() {
  // --- ALL HOOKS MUST BE CALLED AT THE TOP LEVEL ---
  const { user, isLoading: isAuthLoading } = useAuth();
  // const router = useRouter();
  // const { subscription, isLoading: isSubLoading, fetchSubscription } = useSubscription();
  // const { isInTrial, isLoading: isTrialLoading } = useTrialStatus();
  const [uploadStatus, setUploadStatus] = useState<string>(""); 
  // const [isMobile, setIsMobile] = useState<boolean>(false);
  
  // State for document display and filtering
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState<boolean>(true);
  const [selectedFilter, setSelectedFilter] = useState<Filter>({ type: 'special', value: 'recent' }); // Default to recent instead of 'all'
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [isLoadingTypes, setIsLoadingTypes] = useState<boolean>(true);
  const [processingDocId, setProcessingDocId] = useState<string | null>(null); // State for AI processing
  // TODO: Add state for available dates (years/months) later
  const [documentCount, setDocumentCount] = useState<number>(0);
  const [isLoadingCount, setIsLoadingCount] = useState(true);

  // State for chat
  const chatLocalStorageKey = user ? `chatHistory-${user.id}` : null; // Key for localStorage
  const [chatInput, setChatInput] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]); // Initialize empty
  const [isLoadingChat, setIsLoadingChat] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false); // State for mobile sidebar
  const [viewMode, setViewMode] = useState<'chat' | 'documents' | 'table' | 'folder'>('table'); // Default to table view instead of 'chat'
  const chatContainerRef = useRef<HTMLDivElement>(null); 

  // Add new state for virtual file system
  const [fileSystem, setFileSystem] = useState<FileNode[]>([]);
  const [isLoadingFileSystem, setIsLoadingFileSystem] = useState<boolean>(true);

  // Add state for upload dialog
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);

  // Add state for document preview
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);

  // Determine if user has documents
  const hasDocuments = !isLoadingDocuments && documents.length > 0;

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

  // Helper function to build virtual file system
  const buildFileSystem = useCallback((docs: Document[]) => {
    // Skip if no documents
    if (!docs || docs.length === 0) {
      setFileSystem([]);
      return;
    }

    console.log("Building virtual file system from", docs.length, "documents");
    const root: Record<string, FileNode> = {}; // Year folders

    docs.forEach(doc => {
      // Skip documents without dates
      if (!doc.document_date) return;
      
      // Get date components
      const docDate = new Date(doc.document_date);
      if (isNaN(docDate.getTime())) return; // Skip invalid dates
      
      const year = docDate.getFullYear().toString();
      const month = docDate.toLocaleString('default', { month: 'long' });
      const vendor = doc.vendor || 'Unknown Vendor';
      
      // Create year folder if it doesn't exist
      if (!root[year]) {
        root[year] = {
          name: year,
          type: 'folder',
          children: [],
          path: `/${year}`
        };
      }
      
      // Find or create month folder
      let monthFolder = root[year].children.find(child => child.name === month);
      if (!monthFolder) {
        monthFolder = {
          name: month,
          type: 'folder',
          children: [],
          path: `/${year}/${month}`
        };
        root[year].children.push(monthFolder);
      }
      
      // Find or create vendor folder
      let vendorFolder = monthFolder.children.find(child => child.name === vendor);
      if (!vendorFolder) {
        vendorFolder = {
          name: vendor,
          type: 'vendor',
          children: [],
          documents: [],
          path: `/${year}/${month}/${vendor}`
        };
        monthFolder.children.push(vendorFolder);
      }
      
      // Add document to vendor folder
      if (!vendorFolder.documents) {
        vendorFolder.documents = [];
      }
      vendorFolder.documents.push(doc);
    });
    
    // Convert to array and sort
    const fileSystemArray = Object.values(root).sort((a, b) => b.name.localeCompare(a.name)); // Years in descending order
    
    // Sort months in each year (chronological order within year)
    const monthOrder = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    fileSystemArray.forEach(yearFolder => {
      yearFolder.children.sort((a, b) => {
        return monthOrder.indexOf(a.name) - monthOrder.indexOf(b.name);
      });
      
      // Sort vendors alphabetically
      yearFolder.children.forEach(monthFolder => {
        monthFolder.children.sort((a, b) => a.name.localeCompare(b.name));
      });
    });
    
    console.log("Virtual file system built with", fileSystemArray.length, "years");
    setFileSystem(fileSystemArray);
  }, []);

  const fetchDocuments = useCallback(async () => {
    if (!user?.id) return;

    console.log("Starting fetchDocuments for user:", user.id, "with filter:", selectedFilter);
    setIsLoadingDocuments(true);
    
    try {
      // Start with a simple query to get user's documents
      let query = supabase
        .from('documents')
        .select('id, file_path, document_url, uploaded_at, original_filename, document_type, document_date, total_amount, vendor')
        .eq('uploaded_by', user.id);

      // Apply basic sorting/filtering
      if (selectedFilter.type === 'category') {
        // Simple category filter
        query = query.eq('document_type', selectedFilter.value);
      } else if (selectedFilter.type === 'special' && selectedFilter.value === 'recent') {
        // Recent documents
        query = query.order('uploaded_at', { ascending: false }).limit(20);
      } else {
        // Default sorting for all documents and other filters
        query = query.order('uploaded_at', { ascending: false });
      }

      // Execute query
      const { data, error } = await query;
      
      if (error) {
        console.log("Error in Supabase query:", error.message);
        setDocuments([]);
      } else {
        console.log(`Fetched ${data?.length || 0} documents`);
        
        // For path filtering, do it in memory rather than in query
        if (selectedFilter.type === 'path' && data) {
          const pathParts = selectedFilter.value.split('/').filter(Boolean);
          let filteredData = [...data];
          
          if (pathParts.length > 0) {
            // Filter by year
            const year = pathParts[0];
            filteredData = filteredData.filter(doc => 
              doc.document_date && doc.document_date.startsWith(year)
            );
            
            if (pathParts.length > 1) {
              // Filter by month
              const monthName = pathParts[1];
              const monthIndex = ["January", "February", "March", "April", "May", "June", 
                                "July", "August", "September", "October", "November", "December"]
                                .indexOf(monthName);
                                  
              if (monthIndex !== -1) {
                const monthNum = (monthIndex + 1).toString().padStart(2, '0');
                filteredData = filteredData.filter(doc => 
                  doc.document_date && doc.document_date.startsWith(`${year}-${monthNum}`)
                );
                
                if (pathParts.length > 2) {
                  // Filter by vendor
                  const vendor = pathParts[2];
                  filteredData = filteredData.filter(doc => doc.vendor === vendor);
                }
              }
            }
          }
          
          setDocuments(filteredData);
        } else {
          // For non-path filters, use the data directly
          setDocuments(data || []);
        }
        
        // Always rebuild the file system after fetching documents
        buildFileSystem(data || []);
      }
    } catch (error) {
      console.error("Error in fetchDocuments:", error);
      setDocuments([]);
    } finally {
      setIsLoadingDocuments(false);
    }
  }, [user?.id, selectedFilter, buildFileSystem]);

  // Function to fetch document count
  const fetchDocumentCount = useCallback(async () => {
    if (!user?.id) return;
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
  }, [user?.id]);

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
  }, [user?.id, fetchDocuments, fetchTypes, fetchDocumentCount, selectedFilter]);

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
  }, [processingDocId, fetchDocuments, fetchTypes, fetchDocumentCount, selectedFilter]); 

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

  // Call this when documents are loaded
  useEffect(() => {
    if (!isLoadingDocuments && documents.length > 0) {
      setIsLoadingFileSystem(true);
      buildFileSystem(documents);
      setIsLoadingFileSystem(false);
    } else if (!isLoadingDocuments) {
      setFileSystem([]);
      setIsLoadingFileSystem(false);
    }
  }, [documents, isLoadingDocuments, buildFileSystem]);

  // Add a useEffect to switch to table view when path filter is applied
  useEffect(() => {
    // When a path filter is selected, switch to folder view
    if (selectedFilter.type === 'path') {
      setViewMode('folder');
      console.log(`Path navigation: ${selectedFilter.value}`);
    } else if (selectedFilter.type === 'special' || selectedFilter.type === 'category') {
      // For recent, all documents, or category filters - use table view
      setViewMode('table');
    }
  }, [selectedFilter]);

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
      setViewMode('documents'); // Switch to documents view
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

  // --- ADD Clear Chat Handler ---
  const handleClearChat = () => {
    console.log("Clearing chat...");
    // Reset to initial message or empty array
    const initialMessage: ChatMessage = {
      id: `asst-init-${Date.now()}`,
      role: 'assistant',
      content: "Hi! I'm your document assistant. How can I help you search through your documents today?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatMessages([initialMessage]);
    // Clear localStorage
    if (chatLocalStorageKey) {
      localStorage.removeItem(chatLocalStorageKey);
      console.log("Cleared localStorage chat history.");
    }
  };
  // -----------------------------

  // Recursive component for rendering the file tree
  const FileTreeNode = ({ node, level = 0 }: { node: FileNode; level?: number }) => {
    const isCurrentPath = selectedFilter.type === 'path' && selectedFilter.value === node.path;
    const nodeIcon = node.type === 'folder' ? <Folder className="mr-3 h-5 w-5" /> : <FileText className="mr-3 h-5 w-5" />;
    
    return (
      <div className="flex flex-col">
        <Button
          variant={isCurrentPath ? "secondary" : "ghost"}
          className={`w-full justify-start gap-2 ${level > 0 ? `pl-${level * 4 + 2}` : ''}`}
          onClick={() => handleFilterChange({ type: 'path', value: node.path })}
        >
          {nodeIcon}
          <span className="truncate">{node.name} {node.documents && `(${node.documents.length})`}</span>
        </Button>
        
        {node.children && node.children.length > 0 && (
          <div className="flex flex-col">
            {node.children.map((child, index) => (
              <FileTreeNode key={`${child.path}-${index}`} node={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  // Add preview handler
  const handlePreview = (doc: Document) => {
    setPreviewDoc(doc);
    setIsPreviewOpen(true);
  };

  // Add download handler
  const handleDownload = (doc: Document | null) => {
    if (!doc || !doc.document_url) return;
    
    // Create a temporary anchor element
    const a = document.createElement('a');
    a.href = doc.document_url;
    a.download = generateDisplayFilename(doc); // Use the display filename for download
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
                  {/* Main section */}
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
                  
                  {/* Categories section */}
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
                  
                  {/* Upload button - only shown when user has documents */}
                  {hasDocuments && (
                    <>
                      <h3 className="text-xs font-semibold text-slate-500 uppercase mt-4 mb-2">Actions</h3>
                      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" className="w-full justify-start gap-2">
                            <Plus className="h-4 w-4" />
                            Upload Document
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Upload Document</DialogTitle>
                            <DialogDescription>
                              Drag and drop files or click to browse
                            </DialogDescription>
                          </DialogHeader>
                          <FileUpload 
                            onUploadComplete={(result) => {
                              handleUploadSuccess(result);
                              // Close the dialog after successful upload
                              if (result.success) {
                                setTimeout(() => setIsUploadDialogOpen(false), 1000);
                              }
                            }} 
                          />
                          {uploadStatus && (
                            <div className={`mt-4 p-2 rounded text-sm ${uploadStatus.startsWith('File already exists') ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'}`}>
                              {uploadStatus}
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </>
                  )}
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
         viewMode === 'documents' ? 'flex w-full' : 'hidden', // Mobile visibility
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

            {/* View toggle buttons */}
            <div className="flex items-center space-x-2">
              <Button
                variant={viewMode === 'table' ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode('table')}
                title="Table view"
              >
                <FileText className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'folder' ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode('folder')}
                title="Folder view"
              >
                <Folder className="h-4 w-4" />
              </Button>
            </div>

            {/* Switch to Chat Button - Only on mobile */} 
            <div className="md:hidden ml-2"> {/* Wrapper for mobile */} 
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setViewMode('chat')}
              >
                <MessageSquare className="h-6 w-6" />
                <span className="sr-only">Switch to Chat</span>
              </Button>
            </div>
         </div>

         {/* Upload Zone - Only show for new users with no documents */}
         {!hasDocuments && (
           <div className="p-4 md:p-6 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg bg-slate-100 dark:bg-slate-800 flex-shrink-0 mb-4">
              <div className="text-center max-w-md mx-auto">
                <h3 className="text-lg font-medium mb-2">Upload your first document</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                  Drag and drop files or click to browse
                </p>
                <FileUpload onUploadComplete={handleUploadSuccess} /> 
                {uploadStatus && ( 
                  <p className={`mt-4 text-sm font-medium ${uploadStatus.startsWith('File already exists') ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}`}>
                    {uploadStatus}
                  </p>
                )}
              </div>
           </div>
         )}
        
        {/* Document Display Area */} 
        <div className="flex-grow overflow-auto border dark:border-slate-700 rounded-md h-0 min-h-0"> 
          {viewMode === 'table' ? (
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
                    const displayFilename = generateDisplayFilename(doc);

                    return (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium truncate max-w-0" title={displayFilename}>
                          {displayFilename}
                        </TableCell>
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
                          <div className="flex justify-end space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handlePreview(doc)}
                            >
                              <FileText className="h-4 w-4 mr-1" />
                              Preview
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleDownload(doc)}
                            >
                              <Download className="h-4 w-4" />
                              <span className="sr-only">Download</span>
                            </Button>
                          </div>
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
          ) : (
            <div className="p-4">
              {/* Breadcrumb navigation */}
              {selectedFilter.type === 'path' && (
                <nav className="mb-6 flex items-center space-x-2 text-sm">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="flex items-center gap-1"
                    onClick={() => handleFilterChange({ type: 'special', value: 'all' })}
                  >
                    <Home className="h-4 w-4" />
                    <span>Home</span>
                  </Button>
                  
                  {selectedFilter.value.split('/').filter(Boolean).map((part, index, array) => {
                    // Build path up to this part
                    const pathToHere = '/' + array.slice(0, index + 1).join('/');
                    
                    return (
                      <React.Fragment key={index}>
                        <span className="text-slate-400">/</span>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleFilterChange({ type: 'path', value: pathToHere })}
                          className={index === array.length - 1 ? 'font-medium' : ''}
                        >
                          {part}
                        </Button>
                      </React.Fragment>
                    );
                  })}
                </nav>
              )}
              
              {/* Folder/file grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {isLoadingFileSystem ? (
                  // Loading state for folder view
                  [...Array(8)].map((_, i) => (
                    <Skeleton key={`folder-skel-${i}`} className="h-32 rounded-md" />
                  ))
                ) : selectedFilter.type === 'path' ? (
                  // Show contents of current path
                  (() => {
                    // Find current node based on path
                    const pathParts = selectedFilter.value.split('/').filter(Boolean);
                    console.log('Current path parts:', pathParts);
                    
                    if (pathParts.length === 0) {
                      // Root level - show years
                      console.log('Showing root level (years):', fileSystem.length);
                      return fileSystem.length > 0 ? (
                        fileSystem.map((yearNode, index) => (
                          <button 
                            key={`year-${index}`}
                            onClick={() => handleFilterChange({ type: 'path', value: yearNode.path })}
                            className="p-4 border rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 hover:shadow-sm transition-all flex flex-col items-center"
                          >
                            <Folder className="h-6 w-6 text-blue-500 mb-2" />
                            <p className="font-medium">{yearNode.name}</p>
                            <p className="text-xs text-slate-500 mt-1">{yearNode.children.length} folders</p>
                          </button>
                        ))
                      ) : (
                        <div className="col-span-4 flex flex-col items-center justify-center py-12">
                          <Folder className="h-8 w-8 text-slate-300 mb-4" />
                          <h3 className="text-xl font-medium text-slate-700 dark:text-slate-300">No Folders Found</h3>
                          <p className="text-slate-500 mt-2">Upload documents with dates to view them in folders</p>
                        </div>
                      );
                    }
                    
                    // Find current node
                    let currentNode = null;
                    let currentLevel = fileSystem;
                    
                    for (let i = 0; i < pathParts.length; i++) {
                      const part = pathParts[i];
                      const foundNode = currentLevel.find(node => node.name === part);
                      
                      if (!foundNode) {
                        console.log(`Node not found for part: ${part}`);
                        return (
                          <div className="col-span-4 text-center py-12">
                            <p className="text-slate-500">Folder not found. <button onClick={() => handleFilterChange({ type: 'special', value: 'all' })} className="text-blue-500 hover:underline">Return home</button></p>
                          </div>
                        );
                      }
                      
                      currentNode = foundNode;
                      currentLevel = foundNode.children;
                    }
                    
                    // We have the current node, show its contents
                    if (currentNode) {
                      console.log(`Showing contents of ${currentNode.name}, children: ${currentNode.children.length}`);
                      
                      if (currentNode.type === 'vendor' && currentNode.documents && currentNode.documents.length > 0) {
                        // If vendor node with documents, show documents
                        return currentNode.documents.map((doc, index) => (
                          <div 
                            key={`doc-${index}`}
                            className="p-4 border rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 hover:shadow-md transition-all flex flex-col items-center"
                          >
                            <FileText className="h-6 w-6 text-blue-500 mb-2" />
                            <p className="font-medium text-center text-sm line-clamp-2" title={generateDisplayFilename(doc)}>
                              {generateDisplayFilename(doc)}
                            </p>
                            <p className="text-xs text-slate-500 mt-1 mb-3">
                              {doc.document_date ? new Date(doc.document_date).toLocaleDateString() : '-'}
                            </p>
                            <div className="mt-auto flex space-x-2 w-full justify-center">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handlePreview(doc)}
                                className="flex-1 max-w-24"
                              >
                                <FileText className="h-3 w-3 mr-1" />
                                Preview
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleDownload(doc)}
                                className="flex items-center justify-center"
                              >
                                <Download className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ));
                      } else if (currentNode.children && currentNode.children.length > 0) {
                        // If folder with children, show children
                        return currentNode.children.map((childNode, index) => (
                          <button 
                            key={`folder-${index}`}
                            onClick={() => handleFilterChange({ type: 'path', value: childNode.path })}
                            className="p-4 border rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 hover:shadow-sm transition-all flex flex-col items-center"
                          >
                            {childNode.type === 'folder' ? (
                              <Folder className="h-6 w-6 text-blue-500 mb-2" />
                            ) : (
                              <Building2 className="h-6 w-6 text-green-500 mb-2" />
                            )}
                            <p className="font-medium">{childNode.name}</p>
                            {childNode.documents && childNode.documents.length > 0 ? (
                              <p className="text-xs text-slate-500 mt-1">{childNode.documents.length} document{childNode.documents.length !== 1 ? 's' : ''}</p>
                            ) : childNode.children && childNode.children.length > 0 ? (
                              <p className="text-xs text-slate-500 mt-1">{childNode.children.length} folder{childNode.children.length !== 1 ? 's' : ''}</p>
                            ) : null}
                          </button>
                        ));
                      } else {
                        // Empty folder
                        return (
                          <div className="col-span-4 flex flex-col items-center justify-center py-12">
                            <Folder className="h-8 w-8 text-slate-300 mb-4" />
                            <h3 className="text-xl font-medium text-slate-700 dark:text-slate-300">Empty Folder</h3>
                            <p className="text-slate-500 mt-2">This folder has no contents</p>
                          </div>
                        );
                      }
                    }
                    
                    // Fallback
                    return (
                      <div className="col-span-4 flex flex-col items-center justify-center py-12">
                        <Folder className="h-8 w-8 text-slate-300 mb-4" />
                        <h3 className="text-xl font-medium text-slate-700 dark:text-slate-300">Navigation Error</h3>
                        <p className="text-slate-500 mt-2">Could not find the requested folder</p>
                      </div>
                    );
                  })()
                ) : (
                  // Show years at top level of file system (default view)
                  fileSystem.length > 0 ? (
                    fileSystem.map((yearNode, index) => (
                      <button 
                        key={`folder-${index}`}
                        onClick={() => handleFilterChange({ type: 'path', value: yearNode.path })}
                        className="p-4 border rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 hover:shadow-sm transition-all flex flex-col items-center"
                      >
                        <Folder className="h-6 w-6 text-blue-500 mb-2" />
                        <p className="font-medium">{yearNode.name}</p>
                        <p className="text-xs text-slate-500 mt-1">{yearNode.children.length} folders</p>
                      </button>
                    ))
                  ) : (
                    <div className="col-span-4 flex flex-col items-center justify-center py-12">
                      <Folder className="h-8 w-8 text-slate-300 mb-4" />
                      <h3 className="text-xl font-medium text-slate-700 dark:text-slate-300">No Folders Found</h3>
                      <p className="text-slate-500 mt-2">Upload documents with dates to view them in folders</p>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div> 
      </div>

      {/* Right Chat Panel - Full width on mobile, fixed width on medium+ */}
      {/* Ensure it takes full height and handles overflow */} 
      {/* Mobile: Show based on mobileView state. Desktop: Always show fixed width */}
      <div className={cn(
         "bg-white dark:bg-neutral-dark flex flex-col h-full max-h-full overflow-hidden", // Basic structure
         viewMode === 'chat' ? 'flex w-full' : 'hidden', // Mobile visibility
         "md:flex md:w-[400px] md:flex-shrink-0 md:border-l dark:border-slate-700 px-4 sm:px-6 lg:px-8 py-4 md:py-6" // Desktop layout & padding
      )}>
         {/* Chat Header */} 
         <div className="flex items-center justify-between border-b dark:border-slate-700 pb-2 flex-shrink-0">
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

            {/* Title */}
            <h2 className="text-lg font-semibold text-center md:text-left">Document Assistant</h2>
            
            {/* Clear Chat Button */} 
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClearChat}
              title="Clear chat history"
            >
              <Trash2 className="h-5 w-5" />
              <span className="sr-only">Clear Chat</span>
            </Button>

            {/* Placeholder for mobile layout (if needed) */} 
             {/* <div className="md:hidden w-10"></div> */}
         </div>

         {/* Chat Messages Container */} 
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
                       <ReactMarkdown 
                         remarkPlugins={[remarkGfm]}
                         components={{
                           a: ({ children, href, title }) => { 
                             if (href?.startsWith('preview:')) {
                               const documentId = href.substring(8); // Length of "preview:"
                               const doc = documents.find(d => d.id === documentId);
                               if (doc) {
                                 return (
                                   <Button
                                     variant="link"
                                     className="inline p-0 h-auto font-medium text-current hover:text-current"
                                     title={title}
                                     onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                                        e.preventDefault(); 
                                        handlePreview(doc);
                                     }}
                                   >
                                     {children}
                                   </Button>
                                 );
                               } else {
                                 // Fallback if doc not found
                                 return <span title={title}>{children} (Preview unavailable)</span>;
                               }
                             } else {
                               // Default link rendering
                               return <a href={href} target="_blank" rel="noopener noreferrer" title={title}>{children}</a>;
                             }
                           },
                         }}
                       >
                         {typeof message.content === 'string' ? message.content : String(message.content)}
                       </ReactMarkdown>
                     </div>
                   </div>
                 </div>
               ))
             )}
             {/* Loading indicator */}
             {isLoadingChat && (
               <div className="flex justify-start">
                 <div className="bg-slate-200 dark:bg-slate-700 max-w-[85%] px-4 py-2 rounded-lg dark:text-white">
                   <Loader2 className="h-5 w-5 animate-spin" />
                 </div>
               </div>
             )}
           </div>
           
         {/* Chat Input Section */}
         <div className="border-t dark:border-slate-700 pt-4">
           <form onSubmit={handleSendMessage} className="flex flex-col md:flex-row gap-2">
             <Textarea
               value={chatInput}
               onChange={(e) => setChatInput(e.target.value)}
               placeholder="Ask about your documents..."
               className="flex-grow min-h-[60px] max-h-[120px]"
               onKeyDown={(e) => {
                 if (e.key === 'Enter' && !e.shiftKey) {
                   e.preventDefault(); 
                   if (chatInput.trim() && !isLoadingChat) {
                     handleSendMessage(e as unknown as React.FormEvent); 
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
       </div>{/* End Right Chat Panel */}

      {/* Document Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl w-[90vw]">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle className="truncate max-w-[60%]">
              {previewDoc ? generateDisplayFilename(previewDoc) : 'Document Preview'}
            </DialogTitle>
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleDownload(previewDoc)}
                disabled={!previewDoc}
              >
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                asChild
              >
                <a 
                  href={previewDoc?.document_url || '#'} 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Open
                </a>
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsPreviewOpen(false)}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </DialogHeader>
          
          {previewDoc && (
            <div className="mt-4 w-full h-[70vh] overflow-hidden">
              <object 
                data={previewDoc.document_url}
                type="application/pdf"
                className="w-full h-full border-0 rounded-md"
              >
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-md p-8">
                  <FileText className="h-16 w-16 text-slate-400 mb-4" />
                  <p className="text-slate-600 dark:text-slate-300 mb-2">Cannot display this document in the preview.</p>
                  <div className="flex space-x-4 mt-4">
                    <Button
                      variant="outline"
                      onClick={() => handleDownload(previewDoc)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                    <Button asChild>
                      <a 
                        href={previewDoc.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open in New Tab
                      </a>
                    </Button>
                  </div>
                </div>
              </object>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 gap-4">
        <AiSearch />
      </div>
    </div> // End Main Flex Container
  );
}