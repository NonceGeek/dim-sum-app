import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearch, type SearchResult } from '@/lib/api/search';
import { useSearchHistoryStore } from '@/lib/store/useSearchHistoryStore';

const DEBOUNCE_MS = 300;
const MAX_SUGGESTIONS = 6;

type DropdownMode = 'history' | 'suggestions';

interface UseSearchDropdownOptions {
  query: string;
  selectedDataset: string[];
  /** Called when user selects an item (either history or suggestion). Responsible for updating prompt + triggering search. */
  onSearchTerm: (term: string) => void;
}

interface UseSearchDropdownReturn {
  showDropdown: boolean;
  mode: DropdownMode;
  suggestions: SearchResult[];
  history: string[];
  activeIndex: number;
  wrapperRef: React.RefObject<HTMLElement | null>;
  handleFocus: () => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  closeDropdown: () => void;
  selectItem: (term: string) => void;
  addToHistory: (term: string) => void;
  removeHistory: (term: string) => void;
  clearHistory: () => void;
}

export function useSearchDropdown({
  query,
  selectedDataset,
  onSearchTerm,
}: UseSearchDropdownOptions): UseSearchDropdownReturn {
  const { mutate: fetchSuggestions } = useSearch();
  const { history, add, remove, clear } = useSearchHistoryStore();

  const [showDropdown, setShowDropdown] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLElement | null>(null);
  // Only auto-open dropdown if the user has explicitly focused the input
  const hasFocusedRef = useRef(false);

  // Derived mode: history when empty, suggestions when typing
  const mode: DropdownMode = query.trim() ? 'suggestions' : 'history';

  // Debounced suggestion fetch when query changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSuggestions([]);
    setActiveIndex(-1);

    if (!query.trim()) {
      // empty → stay open if focused (history mode), no fetch needed
      return;
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(
        { keyword: query.trim(), category: JSON.stringify(selectedDataset) },
        {
          onSuccess: (data) => {
            setSuggestions(data.slice(0, MAX_SUGGESTIONS));
            setActiveIndex(-1);
          },
          onError: () => setSuggestions([]),
        }
      );
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, JSON.stringify(selectedDataset)]);

  // Click-outside to close
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  const handleFocus = useCallback(() => {
    hasFocusedRef.current = true;
    // Show dropdown on focus only if there's history (history mode) or suggestions loaded
    if (!query.trim() && history.length > 0) {
      setShowDropdown(true);
    } else if (query.trim() && suggestions.length > 0) {
      setShowDropdown(true);
    }
  }, [query, history.length, suggestions.length]);

  // Keep dropdown open when suggestions arrive — only if user has focused the input
  useEffect(() => {
    if (suggestions.length > 0 && hasFocusedRef.current) setShowDropdown(true);
  }, [suggestions]);

  // Keep dropdown open when switching to history mode with items
  useEffect(() => {
    if (!query.trim() && history.length > 0 && showDropdown) {
      setShowDropdown(true);
    }
  }, [query, history.length]);

  const selectItem = useCallback(
    (term: string) => {
      add(term);
      setShowDropdown(false);
      setActiveIndex(-1);
      onSearchTerm(term);
    },
    [add, onSearchTerm]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const items = mode === 'history' ? history : suggestions.map((s) => s.data);
      const count = items.length;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (prev < count - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : count - 1));
        return;
      }
      if (e.key === 'Escape') {
        setShowDropdown(false);
        setActiveIndex(-1);
        return;
      }
      if (e.key === 'Enter') {
        if (showDropdown && activeIndex >= 0 && activeIndex < count) {
          e.preventDefault();
          selectItem(items[activeIndex]);
        }
        // If no active index, let the parent handle Enter (normal search)
      }
    },
    [mode, history, suggestions, showDropdown, activeIndex, selectItem]
  );

  const closeDropdown = useCallback(() => {
    setShowDropdown(false);
    setActiveIndex(-1);
  }, []);

  const removeHistory = useCallback(
    (term: string) => {
      remove(term);
    },
    [remove]
  );

  const clearHistory = useCallback(() => {
    clear();
    setShowDropdown(false);
  }, [clear]);

  return {
    showDropdown,
    mode,
    suggestions,
    history,
    activeIndex,
    wrapperRef,
    handleFocus,
    handleKeyDown,
    closeDropdown,
    selectItem,
    addToHistory: add,
    removeHistory,
    clearHistory,
  };
}
