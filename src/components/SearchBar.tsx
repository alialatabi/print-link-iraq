import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, FileText, Layers, Grid3X3 } from 'lucide-react';
import { useSearch, SearchResult } from '@/hooks/useSearch';
import { motion, AnimatePresence } from 'framer-motion';
import { getOptimizedImageUrl } from '@/lib/imageUtils';

const TYPE_CONFIG: Record<string, { icon: typeof Search; color: string }> = {
  service: { icon: Grid3X3, color: 'bg-primary/15 text-primary' },
  sub_service: { icon: Layers, color: 'bg-cmyk-cyan/15 text-cmyk-cyan' },
  template: { icon: FileText, color: 'bg-accent/20 text-accent-foreground' },
};

const POPULAR_SUGGESTIONS = [
  { label: 'كروت شخصية', query: 'كروت شخصية' },
  { label: 'أطباء', query: 'أطباء' },
  { label: 'مطاعم', query: 'مطاعم' },
  { label: 'محامين', query: 'محامين' },
  { label: 'ستيكرات', query: 'ستيكرات' },
  { label: 'بروشور', query: 'بروشور' },
];

const SearchBar = () => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const { results, loading } = useSearch(query);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (result: SearchResult) => {
    setQuery('');
    setOpen(false);
    navigate(result.link);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
    if (e.key === 'Enter' && results.length > 0) {
      handleSelect(results[0]);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setOpen(true);
  };

  const showDropdown = open;
  const showSuggestions = open && query.trim().length === 0;
  const showResults = open && query.trim().length > 0;

  return (
    <div ref={containerRef} className="relative w-full max-w-xs sm:max-w-sm">
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="ابحث عن خدمة أو قالب..."
          className="w-full h-9 pr-9 pl-8 rounded-xl border border-border/60 bg-muted/40 dark:bg-muted/20 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/60 transition-all duration-150"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); inputRef.current?.focus(); }}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-2 right-0 left-0 bg-card border border-border/60 rounded-2xl shadow-elevated dark:shadow-dark-elevated overflow-hidden z-50 max-h-[360px] overflow-y-auto"
          >
            {showSuggestions ? (
              <div className="p-3">
                <p className="text-[11px] font-medium text-muted-foreground mb-2 px-1">بحث شائع</p>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_SUGGESTIONS.map(s => (
                    <button
                      key={s.query}
                      onClick={() => handleSuggestionClick(s.query)}
                      className="px-3 py-1.5 text-xs font-medium rounded-full border border-border/60 bg-muted/40 hover:bg-primary/10 hover:border-primary/40 hover:text-primary text-foreground transition-all duration-150"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : loading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">جاري التحميل...</div>
            ) : results.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                لا توجد نتائج لـ "{query}"
              </div>
            ) : (
              <div className="py-1.5">
                {results.map(result => {
                  const config = TYPE_CONFIG[result.type];
                  const Icon = config.icon;
                  return (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleSelect(result)}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 text-right hover:bg-muted/60 dark:hover:bg-muted/20 transition-colors duration-100"
                    >
                      <div className={`w-8 h-8 rounded-lg ${config.color} flex items-center justify-center flex-shrink-0`}>
                        {result.iconUrl ? (
                          <img src={getOptimizedImageUrl(result.iconUrl, { width: 32, height: 32 })} alt="" className="w-5 h-5 rounded object-cover" />
                        ) : result.icon ? (
                          <span className="text-sm">{result.icon}</span>
                        ) : (
                          <Icon className="w-4 h-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{result.label}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {result.typeLabel}
                          {result.parentLabel && ` · ${result.parentLabel}`}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SearchBar;
