import React, { useState, useMemo } from 'react';
import { BookOpen, Calendar, Trash2, Play, Layers, Edit2, FolderPlus, Folder, ChevronDown, SortAsc, SortDesc, Filter, XCircle, Combine, CheckSquare, Square } from 'lucide-react';
import { Deck, Category } from '../types';

interface LibraryProps {
  decks: Deck[];
  categories: Category[];
  onSelectDeck: (deck: Deck) => void;
  onDeleteDeck: (id: string) => void;
  onEditDeck: (deck: Deck) => void;
  onCreateNew: () => void;
  onCreateCategory: () => void;
  onDeleteCategory: (id: string) => void;
  onCombineDecks: (deckIds: string[]) => void;
}

type SortOption = 'date-desc' | 'date-asc' | 'name-asc' | 'count-desc';

const Library: React.FC<LibraryProps> = ({ 
  decks, 
  categories,
  onSelectDeck, 
  onDeleteDeck, 
  onEditDeck,
  onCreateNew,
  onCreateCategory,
  onDeleteCategory,
  onCombineDecks
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [isCombineMode, setIsCombineMode] = useState(false);
  const [selectedForCombine, setSelectedForCombine] = useState<string[]>([]);

  // Filter and Sort Logic
  const filteredAndSortedDecks = useMemo(() => {
    let result = [...decks];

    // Filter
    if (selectedCategory !== 'all') {
      if (selectedCategory === 'uncategorized') {
        result = result.filter(d => !d.categoryId);
      } else {
        result = result.filter(d => d.categoryId === selectedCategory);
      }
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc': return b.createdAt - a.createdAt;
        case 'date-asc': return a.createdAt - b.createdAt;
        case 'name-asc': return a.title.localeCompare(b.title);
        case 'count-desc': return b.cards.length - a.cards.length;
        default: return 0;
      }
    });

    return result;
  }, [decks, selectedCategory, sortBy]);

  const toggleCombineSelection = (deckId: string) => {
    setSelectedForCombine(prev => 
      prev.includes(deckId) ? prev.filter(id => id !== deckId) : [...prev, deckId]
    );
  };

  const handleCombineClick = () => {
    if (isCombineMode) {
      if (selectedForCombine.length >= 2) {
        onCombineDecks(selectedForCombine);
        setIsCombineMode(false);
        setSelectedForCombine([]);
      } else {
        setIsCombineMode(false);
        setSelectedForCombine([]);
      }
    } else {
      setIsCombineMode(true);
      setSelectedForCombine([]);
    }
  };

  if (decks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center animate-in fade-in duration-500">
        <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
          <BookOpen className="w-10 h-10 text-indigo-300" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Your library is empty</h2>
        <p className="text-slate-500 mb-8 max-w-sm">
          Generate flashcards from PDFs and save them here to build your personal study collection.
        </p>
        <button
          onClick={onCreateNew}
          className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <Layers className="w-4 h-4" />
          Create First Deck
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto animate-in slide-in-from-bottom-4 duration-500 flex flex-col gap-6">
      
      {/* Header with Sort and Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-600" />
            My Library
          </h2>
          <p className="text-sm text-slate-500 mt-1">
             {decks.length} deck{decks.length !== 1 ? 's' : ''} total
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Sort Dropdown */}
          <div className="relative group">
             <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600">
                {sortBy === 'date-desc' && <Calendar className="w-4 h-4" />}
                {sortBy === 'name-asc' && <SortAsc className="w-4 h-4" />}
                {sortBy === 'count-desc' && <Layers className="w-4 h-4" />}
                <select 
                   value={sortBy} 
                   onChange={(e) => setSortBy(e.target.value as SortOption)}
                   className="bg-transparent outline-none appearance-none cursor-pointer pr-4"
                >
                   <option value="date-desc">Newest First</option>
                   <option value="date-asc">Oldest First</option>
                   <option value="name-asc">Alphabetical (A-Z)</option>
                   <option value="count-desc">Most Cards</option>
                </select>
                <ChevronDown className="w-3 h-3 text-slate-400 absolute right-3 pointer-events-none" />
             </div>
          </div>

          <button
            onClick={handleCombineClick}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              isCombineMode && selectedForCombine.length >= 2
                ? 'bg-green-600 text-white hover:bg-green-700'
                : isCombineMode
                ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Combine className="w-4 h-4" />
            {isCombineMode 
              ? (selectedForCombine.length >= 2 ? `Merge ${selectedForCombine.length} Decks` : 'Cancel Combine') 
              : 'Combine'}
          </button>

          <button
            onClick={onCreateNew}
            className="flex-1 md:flex-none px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
          >
            <Layers className="w-4 h-4" />
            New Deck
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <button
           onClick={() => setSelectedCategory('all')}
           className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5
             ${selectedCategory === 'all' 
               ? 'bg-slate-800 text-white' 
               : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
             }`}
        >
           All Decks
        </button>
        
        {categories.map(cat => (
           <div key={cat.id} className="relative group/cat">
             <button
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5
                  ${selectedCategory === cat.id 
                    ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' 
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
             >
                <Folder className="w-3.5 h-3.5" />
                {cat.name}
             </button>
             {/* Tiny delete category button that appears on hover */}
             <button 
                onClick={(e) => { e.stopPropagation(); onDeleteCategory(cat.id); }}
                className="absolute -top-1 -right-1 hidden group-hover/cat:flex w-4 h-4 bg-red-500 text-white rounded-full items-center justify-center shadow-sm hover:scale-110"
                title="Delete Category"
             >
                <XCircle className="w-3 h-3" />
             </button>
           </div>
        ))}

        <button
           onClick={() => setSelectedCategory('uncategorized')}
           className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5
             ${selectedCategory === 'uncategorized' 
               ? 'bg-slate-200 text-slate-800' 
               : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
             }`}
        >
           Uncategorized
        </button>

        <button
           onClick={onCreateCategory}
           className="px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100 transition-colors flex items-center gap-1"
        >
           <FolderPlus className="w-3.5 h-3.5" />
           New Category
        </button>
      </div>

      {/* Decks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAndSortedDecks.length > 0 ? (
          filteredAndSortedDecks.map((deck) => {
            const categoryName = categories.find(c => c.id === deck.categoryId)?.name;
            const isSelected = selectedForCombine.includes(deck.id);

            return (
              <div 
                key={deck.id}
                onClick={() => isCombineMode ? toggleCombineSelection(deck.id) : null}
                className={`group bg-white border rounded-xl p-5 transition-all duration-200 flex flex-col h-full ${
                  isCombineMode 
                    ? 'cursor-pointer hover:border-indigo-400' 
                    : 'hover:border-indigo-300 hover:shadow-md'
                } ${
                  isSelected ? 'border-indigo-500 ring-2 ring-indigo-200 bg-indigo-50/30' : 'border-slate-200'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex flex-col gap-1">
                     <div className="flex gap-2">
                       <div className={`p-2 rounded-lg transition-colors self-start ${
                         isSelected ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100'
                       }`}>
                         <BookOpen className="w-5 h-5" />
                       </div>
                     </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {isCombineMode ? (
                      <div className={`p-1 rounded-md ${isSelected ? 'text-indigo-600' : 'text-slate-300'}`}>
                        {isSelected ? <CheckSquare className="w-6 h-6" /> : <Square className="w-6 h-6" />}
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditDeck(deck);
                          }}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Edit Deck"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteDeck(deck.id);
                          }}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Deck"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="mb-auto">
                   {categoryName && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500 mb-2">
                         {categoryName}
                      </span>
                   )}
                   <h3 className="font-bold text-lg text-slate-800 line-clamp-2 leading-tight">
                     {deck.title}
                   </h3>
                </div>

                <div className="mt-4 pt-4 flex items-center justify-between border-t border-slate-50">
                  <div className="flex flex-col text-xs text-slate-500">
                    <span className="flex items-center gap-1 mb-1">
                      <Layers className="w-3 h-3" />
                      {deck.cards.length} Cards
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(deck.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  
                  {!isCombineMode && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectDeck(deck);
                      }}
                      className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-bold hover:bg-indigo-600 hover:text-white transition-colors flex items-center gap-2"
                    >
                      Study
                      <Play className="w-3 h-3 fill-current" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-slate-400">
             <Filter className="w-10 h-10 mb-3 opacity-20" />
             <p>No decks found in this category.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Library;