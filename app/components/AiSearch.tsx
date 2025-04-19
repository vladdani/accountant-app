'use client';

import { useState } from 'react';
import { aiSearchDocumentsAction } from '@/app/actions/ai-search';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { StructuredQueryResult } from '@/types/actions';

export function AiSearch() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<StructuredQueryResult[]>([]);
  const [interpretation, setInterpretation] = useState('');
  const [error, setError] = useState('');
  
  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    
    if (!query.trim()) return;
    
    setIsSearching(true);
    setError('');
    
    try {
      const result = await aiSearchDocumentsAction(query);
      
      if (result.success && result.data) {
        setResults(result.data);
        setInterpretation(result.interpretation || '');
        console.log(`Found ${result.data.length} results`);
      } else {
        setError(result.error || 'No results found');
        setResults([]);
        console.log(`Search error: ${result.error}`);
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('An error occurred during search');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }
  
  // Add a direct search function as a fallback
  async function handleAlternativeSearch() {
    if (!query.trim()) return;
    
    setIsSearching(true);
    setError('');
    
    try {
      // Extract raw query as search terms and attempt a direct search
      const searchTerms = query.trim().split(/\s+/).filter(term => term.length > 2);
      console.log(`Trying alternative search using terms: ${searchTerms.join(', ')}`);
      
      const directSearchParams = { 
        search_terms: searchTerms
      };
      
      const { queryStructuredDocumentsAction } = await import('@/app/actions/query-structured-documents');
      const result = await queryStructuredDocumentsAction(directSearchParams);
      
      if (result.success && result.data && result.data.length > 0) {
        setResults(result.data);
        setInterpretation(`I searched directly using the keywords: ${searchTerms.join(', ')}`);
      } else {
        // If both searches failed
        setError(`No results found. Please try different search terms.`);
        setResults([]);
      }
    } catch (err) {
      console.error('Alternative search error:', err);
      setError('An error occurred during search');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }
  
  return (
    <div className="w-full max-w-4xl">
      <form onSubmit={handleSearch} className="flex w-full items-center space-x-2 mb-4">
        <Input
          type="text"
          placeholder="Search documents using natural language (e.g., 'invoices from Amazon in 2023')"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1"
          disabled={isSearching}
        />
        <Button type="submit" disabled={isSearching}>
          {isSearching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Search
        </Button>
      </form>
      
      {error && (
        <div className="text-red-500 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span>{error}</span>
          {error.includes('No results found') && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleAlternativeSearch}
              disabled={isSearching}
            >
              Try keyword search instead
            </Button>
          )}
        </div>
      )}
      
      {interpretation && (
        <div className="text-muted-foreground mb-4 italic text-sm">
          {interpretation}
        </div>
      )}
      
      {results.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {results.map((doc) => (
            <Card key={doc.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{doc.name || 'Unnamed document'}</CardTitle>
                <CardDescription>{doc.vendor || 'Unknown vendor'}</CardDescription>
              </CardHeader>
              <CardContent className="pb-2 text-sm">
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Type:</span>
                  <span>{doc.document_type || 'Unknown'}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Date:</span>
                  <span>{doc.document_date || 'Unknown'}</span>
                </div>
                {doc.total_amount !== null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount:</span>
                    <span>{doc.total_amount} {doc.currency || ''}</span>
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <a href={doc.url || '#'} target="_blank" rel="noopener noreferrer">
                    View Document
                  </a>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : !isSearching && !error && (
        <div className="text-center text-muted-foreground py-8">
          No documents found. Try a different search.
        </div>
      )}
    </div>
  );
} 