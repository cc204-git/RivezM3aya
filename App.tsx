import React, { useState, useEffect } from 'react';
import { Brain, Sparkles, Layers, BookOpen, CheckCircle, AlertCircle, X, Trash2, Edit2, Plus, Folder, LogOut } from 'lucide-react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import FileUpload from './components/FileUpload';
import FlashcardDeck from './components/FlashcardDeck';
import Library from './components/Library';
import Login from './components/Login';
import { AppState, Deck, FlashcardData, Category, DeckType } from './types';
import { generateFlashcardsFromContent } from './services/geminiService';
import { saveDeck, getDecks, deleteDeck, getCategories, saveCategory, deleteCategory, shareCategory } from './services/storageService';
import { saveFilesLocally, deleteFilesLocally } from './services/localFileStorage';

const App: React.FC = () => {
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isWelcoming, setIsWelcoming] = useState(false);
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [currentDeck, setCurrentDeck] = useState<Deck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedDecks, setSavedDecks] = useState<Deck[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Store the raw file data and instructions to allow regeneration
  const [lastUploadedAssets, setLastUploadedAssets] = useState<{ name: string; mimeType: string; data: string }[] | null>(null);
  const [lastInstructions, setLastInstructions] = useState<string>('');
  
  // UI State for Modals and Toasts
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showEditDeckModal, setShowEditDeckModal] = useState(false);
  
  const [deckToDelete, setDeckToDelete] = useState<string | null>(null);
  const [deckToEdit, setDeckToEdit] = useState<Deck | null>(null);
  
  const [saveName, setSaveName] = useState('');
  const [saveCategoryId, setSaveCategoryId] = useState<string>('');
  
  const [newCategoryName, setNewCategoryName] = useState('');
  
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Load data on mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          name: firebaseUser.displayName || 'User',
          email: firebaseUser.email || ''
        });
        await refreshData();
      } else {
        setUser(null);
        setSavedDecks([]);
        setCategories([]);
      }
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Auto-dismiss welcome screen
  useEffect(() => {
    if (isWelcoming) {
      const timer = setTimeout(() => setIsWelcoming(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [isWelcoming]);

  const handleLogin = (loggedInUser: { name: string; email: string }) => {
    setUser(loggedInUser);
    setIsWelcoming(true);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setAppState(AppState.IDLE);
      setCurrentDeck(null);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const refreshData = async () => {
    setSavedDecks(await getDecks());
    setCategories(await getCategories());
  };

  const handleFilesSelect = async (files: File[], instructions: string = '', deckType: DeckType = DeckType.FLASHCARDS) => {
    setAppState(AppState.PROCESSING);
    setError(null);
    setLastUploadedAssets(null);
    setLastInstructions(instructions);

    try {
      // Check for JSON deck
      const jsonFile = files.find(f => f.name.endsWith('.json') || f.type === 'application/json');
      
      if (jsonFile) {
        const text = await jsonFile.text();
        const savedCards = JSON.parse(text) as FlashcardData[];
        if (!Array.isArray(savedCards) || savedCards.length === 0 || !savedCards[0].question) {
           throw new Error("Invalid flashcard deck file.");
        }
        
        const deck: Deck = {
            id: `imported-${Date.now()}`,
            title: jsonFile.name.replace('.json', ''),
            createdAt: Date.now(),
            cards: savedCards,
            type: DeckType.FLASHCARDS
        };
        
        setCurrentDeck(deck);
        setAppState(AppState.STUDYING);
        return;
      }

      // Process PDFs and Images
      const contentFiles = files.filter(f => 
        f.type === 'application/pdf' || 
        f.name.endsWith('.pdf') ||
        f.type.startsWith('image/') ||
        /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(f.name)
      );

      if (contentFiles.length === 0) throw new Error("No supported files (PDF or Images) selected.");

      const fileReadPromises = contentFiles.map(file => new Promise<{ name: string; mimeType: string; data: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
           const base64String = reader.result as string;
           const base64Data = base64String.split(',')[1];
           let mimeType = file.type;
           if (!mimeType) {
             if (file.name.endsWith('.pdf')) mimeType = 'application/pdf';
             else if (file.name.match(/\.(jpg|jpeg)$/i)) mimeType = 'image/jpeg';
             else if (file.name.match(/\.png$/i)) mimeType = 'image/png';
             else if (file.name.match(/\.webp$/i)) mimeType = 'image/webp';
             else if (file.name.match(/\.heic$/i)) mimeType = 'image/heic';
             else mimeType = 'application/octet-stream';
           }
           resolve({ name: file.name, mimeType, data: base64Data });
        };
        reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
        reader.readAsDataURL(file);
      }));

      const fileData = await Promise.all(fileReadPromises);
      setLastUploadedAssets(fileData);

      const existingCategoryNames = categories.map(c => c.name);
      const result = await generateFlashcardsFromContent(fileData, instructions, deckType, existingCategoryNames);
      
      if (result.cards.length === 0) {
          throw new Error("Could not generate any flashcards.");
      }

      // Handle auto-categorization
      let categoryId = undefined;
      if (result.categoryName && result.categoryName !== "Uncategorized") {
        const existingCat = categories.find(c => c.name.toLowerCase() === result.categoryName.toLowerCase());
        if (existingCat) {
          categoryId = existingCat.id;
        } else {
          // Create new category
          const newCat: Category = { id: `cat-${Date.now()}`, name: result.categoryName };
          await saveCategory(newCat);
          categoryId = newCat.id;
          setCategories(prev => [...prev, newCat]);
        }
      }

      const newDeck: Deck = {
          id: `deck-${Date.now()}`,
          title: result.deckName,
          createdAt: Date.now(),
          cards: result.cards,
          categoryId,
          type: deckType,
          hasSourceFiles: true
      };

      // Auto-save the deck
      await saveDeck(newDeck);
      await saveFilesLocally(newDeck.id, fileData);
      setSavedDecks(prev => [newDeck, ...prev]);

      setCurrentDeck(newDeck);
      setAppState(AppState.STUDYING);

    } catch (err) {
      setAppState(AppState.ERROR);
      setError(err instanceof Error ? err.message : "An error occurred.");
    }
  };

  const handleRegenerate = async () => {
    if (!lastUploadedAssets || lastUploadedAssets.length === 0) return;

    setAppState(AppState.PROCESSING);
    setError(null);

    try {
      // Use stored instructions for regeneration
      const generatedCards = await generateFlashcardsFromContent(lastUploadedAssets, lastInstructions);

      if (generatedCards.length === 0) {
        throw new Error("Could not regenerate flashcards.");
      }

      const currentTitle = currentDeck?.title || `Regenerated Session`;

      const newDeck: Deck = {
        id: `deck-${Date.now()}`,
        title: currentTitle,
        createdAt: Date.now(),
        cards: generatedCards,
        hasSourceFiles: true
      };

      await saveDeck(newDeck);
      await saveFilesLocally(newDeck.id, lastUploadedAssets);
      setSavedDecks(prev => [newDeck, ...prev]);

      setCurrentDeck(newDeck);
      setAppState(AppState.STUDYING);
      setToast({ message: 'Deck regenerated successfully!', type: 'success' });

    } catch (err) {
      setAppState(AppState.ERROR);
      setError(err instanceof Error ? err.message : "An error occurred during regeneration.");
    }
  };

  const handleSaveToLibrary = () => {
    if (!currentDeck) return;
    
    const exists = savedDecks.some(d => d.id === currentDeck.id);
    if (exists) {
        setToast({ message: 'This deck is already saved to your library.', type: 'error' });
        return;
    }

    setSaveName(currentDeck.title);
    setSaveCategoryId('');
    setShowSaveModal(true);
  };

  const confirmSaveDeck = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!currentDeck) return;

    const finalTitle = saveName.trim() || currentDeck.title;
    
    try {
      const deckToSave = { 
        ...currentDeck, 
        title: finalTitle,
        categoryId: saveCategoryId || undefined
      };
      await saveDeck(deckToSave);
      
      setCurrentDeck(deckToSave);
      await refreshData();
      
      setShowSaveModal(false);
      setToast({ message: 'Deck saved successfully!', type: 'success' });
    } catch (e) {
      console.error(e);
      setToast({ message: 'Failed to save deck.', type: 'error' });
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    const newCategory: Category = {
      id: `cat-${Date.now()}`,
      name: newCategoryName.trim()
    };
    
    await saveCategory(newCategory);
    await refreshData();
    setNewCategoryName('');
    setShowCategoryModal(false);
    setToast({ message: 'Category created!', type: 'success' });
  };

  const handleUpdateDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deckToEdit) return;

    try {
      const updatedDeck = {
        ...deckToEdit,
        title: saveName.trim() || deckToEdit.title,
        categoryId: saveCategoryId || undefined
      };
      
      await saveDeck(updatedDeck);
      await refreshData();
      
      if (currentDeck && currentDeck.id === updatedDeck.id) {
        setCurrentDeck(updatedDeck);
      }

      setShowEditDeckModal(false);
      setDeckToEdit(null);
      setToast({ message: 'Deck updated!', type: 'success' });
    } catch (e) {
       setToast({ message: 'Failed to update deck.', type: 'error' });
    }
  };

  const openEditDeckModal = (deck: Deck) => {
    setDeckToEdit(deck);
    setSaveName(deck.title);
    setSaveCategoryId(deck.categoryId || '');
    setShowEditDeckModal(true);
  };

  const confirmDeleteDeck = async () => {
    if (deckToDelete) {
      await deleteDeck(deckToDelete);
      await deleteFilesLocally(deckToDelete);
      await refreshData();
      setDeckToDelete(null);
      setToast({ message: 'Deck deleted.', type: 'success' });
      
      if (currentDeck && currentDeck.id === deckToDelete) {
        setCurrentDeck(null);
        if (appState === AppState.STUDYING) {
           setAppState(AppState.LIBRARY);
        }
      }
    }
  };

  const handleDeleteCategory = async (id: string) => {
     if(window.confirm("Delete this category? Decks in it will become uncategorized.")) {
       await deleteCategory(id);
       await refreshData();
       setToast({ message: 'Category deleted.', type: 'success' });
     }
  };

  const handleCombineDecks = async (deckIds: string[]) => {
    const decksToMerge = savedDecks.filter(d => deckIds.includes(d.id));
    if (decksToMerge.length < 2) return;

    const combinedCards = decksToMerge.flatMap(d => d.cards).map((card, index) => ({
      ...card,
      id: `card-${Date.now()}-${index}`
    }));

    const newDeck: Deck = {
      id: `deck-${Date.now()}`,
      title: `Combined Deck (${decksToMerge.length} decks)`,
      createdAt: Date.now(),
      cards: combinedCards,
      type: decksToMerge[0]?.type || DeckType.FLASHCARDS
    };

    try {
      await saveDeck(newDeck);
      await refreshData();
      setToast({ message: 'Decks combined successfully!', type: 'success' });
      
      // Open the edit modal so the user can immediately rename it
      setDeckToEdit(newDeck);
      setSaveName(newDeck.title);
      setSaveCategoryId(newDeck.categoryId || '');
      setShowEditDeckModal(true);
    } catch (e) {
      setToast({ message: 'Failed to combine decks.', type: 'error' });
    }
  };

  const handleShareCategory = async (categoryId: string, email: string) => {
    try {
      await shareCategory(categoryId, email);
      await refreshData();
      setToast({ message: `Invitation sent to ${email}`, type: 'success' });
    } catch (e) {
      setToast({ message: 'Failed to share category.', type: 'error' });
    }
  };

  const handleGoHome = () => {
    setAppState(AppState.IDLE);
    setCurrentDeck(null);
    setLastUploadedAssets(null);
    setLastInstructions('');
    setError(null);
  };

  const handleGoToLibrary = async () => {
    await refreshData();
    setAppState(AppState.LIBRARY);
    setLastUploadedAssets(null);
    setLastInstructions('');
    setError(null);
  };

  const isCurrentDeckSaved = currentDeck 
    ? savedDecks.some(d => d.id === currentDeck.id) 
    : false;

  const canRegenerate = lastUploadedAssets !== null && lastUploadedAssets.length > 0;

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="flex-1 flex flex-col items-center justify-center animate-pulse">
          <Brain className="w-12 h-12 text-indigo-600 mb-4" />
          <p className="text-slate-500 font-medium">Loading...</p>
        </div>
        <div className="pb-6 text-center text-sm text-slate-500">
          <p>© Made by Eng.Youssef Ouled Abdallah 2026</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  if (isWelcoming) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500">
          <div className="bg-indigo-600 p-4 rounded-2xl shadow-lg mb-6 animate-bounce">
            <Brain className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight text-center">
            Mar7ba bik, <span className="text-indigo-600">{user.name}</span>!
          </h1>
          <p className="mt-4 text-slate-500 animate-pulse">Getting your flashcards ready...</p>
        </div>
        <div className="pb-6 text-center text-sm text-slate-500">
          <p>© Made by Eng.Youssef Ouled Abdallah 2026</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans relative">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={handleGoHome}>
            <div className="bg-indigo-600 p-1.5 rounded-lg">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
              Rivez M3aya
            </span>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
             <button 
                onClick={handleGoToLibrary}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                  ${appState === AppState.LIBRARY 
                    ? 'bg-indigo-50 text-indigo-700' 
                    : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
                  }`}
             >
                <BookOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Library</span>
             </button>
             
             <div className="h-6 w-[1px] bg-slate-200 hidden sm:block"></div>

             <button 
                onClick={handleLogout}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm font-medium transition-colors"
                title="Logout"
             >
               <LogOut className="w-4 h-4" />
               <span className="hidden sm:inline">Logout</span>
             </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 md:py-12 flex-1 flex flex-col">
          
          {appState === AppState.LIBRARY && (
             <Library 
                decks={savedDecks}
                categories={categories}
                onSelectDeck={(d) => { setCurrentDeck(d); setAppState(AppState.STUDYING); }}
                onDeleteDeck={setDeckToDelete}
                onEditDeck={openEditDeckModal}
                onCreateNew={handleGoHome}
                onCreateCategory={() => { setNewCategoryName(''); setShowCategoryModal(true); }}
                onDeleteCategory={handleDeleteCategory}
                onCombineDecks={handleCombineDecks}
                onShareCategory={handleShareCategory}
             />
          )}

          {(appState === AppState.IDLE || appState === AppState.PROCESSING || appState === AppState.ERROR) && (
             <div className="flex-1 flex flex-col items-center justify-center min-h-[500px] animate-in fade-in duration-500">
                <div className="text-center mb-12 max-w-2xl">
                  <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
                    Turn your PDFs & Images into <br/>
                    <span className="text-indigo-600">Smart Flashcards</span>
                  </h1>
                  <p className="text-lg text-slate-500">
                    Upload your lecture notes, textbooks, or diagrams. 
                    Rivez M3aya combines them to generate interactive study aids instantly.
                  </p>
                </div>

                <div className="w-full">
                  <FileUpload 
                    onFilesSelect={handleFilesSelect} 
                    isLoading={appState === AppState.PROCESSING}
                    error={error}
                  />
                </div>
             </div>
          )}

          {appState === AppState.STUDYING && currentDeck && (
            <div className="flex-1 animate-in slide-in-from-bottom-8 duration-700 fade-in">
              <FlashcardDeck 
                cards={currentDeck.cards} 
                deckId={currentDeck.id}
                deckTitle={currentDeck.title}
                isSaved={isCurrentDeckSaved}
                canRegenerate={canRegenerate}
                onReset={handleGoHome}
                onSaveToLibrary={handleSaveToLibrary}
                onRegenerate={handleRegenerate}
              />
            </div>
          )}
        </div>
      </main>
      
      <footer className="bg-white border-t border-slate-200 py-6">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-slate-500">
          <p>© Made by Eng.Youssef Ouled Abdallah 2026</p>
        </div>
      </footer>

      {/* Save Deck Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-slate-900">Save to Library</h3>
                <button onClick={() => setShowSaveModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={confirmSaveDeck}>
                <div className="mb-4">
                  <label htmlFor="deckName" className="block text-sm font-medium text-slate-700 mb-2">Deck Name</label>
                  <input
                    id="deckName"
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="e.g., Biology Chapter 1"
                    autoFocus
                  />
                </div>
                <div className="mb-6">
                  <label htmlFor="category" className="block text-sm font-medium text-slate-700 mb-2">Category (Optional)</label>
                  <select
                    id="category"
                    value={saveCategoryId}
                    onChange={(e) => setSaveCategoryId(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  >
                    <option value="">Uncategorized</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowSaveModal(false)} className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50">Cancel</button>
                  <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">Save Deck</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Deck Modal */}
      {showEditDeckModal && deckToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-slate-900">Edit Deck</h3>
                <button onClick={() => setShowEditDeckModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleUpdateDeck}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Deck Name</label>
                  <input
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Category</label>
                  <select
                    value={saveCategoryId}
                    onChange={(e) => setSaveCategoryId(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  >
                    <option value="">Uncategorized</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowEditDeckModal(false)} className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50">Cancel</button>
                  <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">Update</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Create Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-slate-900">New Category</h3>
                <button onClick={() => setShowCategoryModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleCreateCategory}>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Category Name</label>
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="e.g., Mathematics"
                    autoFocus
                  />
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowCategoryModal(false)} className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50">Cancel</button>
                  <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">Create</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Deck Confirmation Modal */}
      {deckToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Deck?</h3>
              <p className="text-slate-500 mb-6">
                Are you sure you want to delete this deck? This action cannot be undone.
              </p>
              
              <div className="flex gap-3">
                <button onClick={() => setDeckToDelete(null)} className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50">Cancel</button>
                <button onClick={confirmDeleteDeck} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white ${
            toast.type === 'success' ? 'bg-slate-800' : 'bg-red-600'
          }`}>
            {toast.type === 'success' ? <CheckCircle className="w-5 h-5 text-green-400" /> : <AlertCircle className="w-5 h-5 text-white" />}
            <p className="font-medium text-sm">{toast.message}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;