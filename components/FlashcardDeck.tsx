import React, { useState, useEffect } from 'react';
import { RotateCcw, Shuffle, Layers, Check, X, Repeat, Trophy, Download, Bookmark, BookmarkCheck, FileSpreadsheet, FileJson, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { FlashcardData } from '../types';

interface FlashcardDeckProps {
  cards: FlashcardData[];
  deckTitle?: string;
  isSaved?: boolean;
  canRegenerate?: boolean;
  onReset: () => void;
  onSaveToLibrary: () => void;
  onRegenerate?: () => void;
}

const FlashcardDeck: React.FC<FlashcardDeckProps> = ({ 
  cards: initialCards, 
  deckTitle, 
  isSaved = false, 
  canRegenerate = false,
  onReset, 
  onSaveToLibrary,
  onRegenerate
}) => {
  // We manage a queue of cards to study
  const [queue, setQueue] = useState<FlashcardData[]>(initialCards);
  const [completedCount, setCompletedCount] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [totalCards] = useState(initialCards.length);
  const [firstTryCorrectCount, setFirstTryCorrectCount] = useState(0);
  const [seenCards, setSeenCards] = useState<Set<string>>(new Set());
  
  // QCM State
  const [selectedOptions, setSelectedOptions] = useState<number[]>([]);
  const [qcmChecked, setQcmChecked] = useState(false);

  // When the queue changes (new card), ensure it starts face up (question side)
  useEffect(() => {
    setIsFlipped(false);
    setSelectedOptions([]);
    setQcmChecked(false);
  }, [queue]);

  const handleFlip = () => {
    if (queue[0]?.options) return; // Don't flip QCM cards manually
    setIsFlipped(!isFlipped);
  };

  const handleShuffle = () => {
    const shuffled = [...queue].sort(() => Math.random() - 0.5);
    setQueue(shuffled);
    setIsFlipped(false);
    setSelectedOptions([]);
    setQcmChecked(false);
    setFirstTryCorrectCount(0);
    setSeenCards(new Set());
  };

  const handleRestart = () => {
    setQueue(initialCards);
    setCompletedCount(0);
    setIsFlipped(false);
    setSelectedOptions([]);
    setQcmChecked(false);
    setFirstTryCorrectCount(0);
    setSeenCards(new Set());
  };

  const handleDownloadJson = () => {
    const dataStr = JSON.stringify(initialCards, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${deckTitle || 'flashcards'}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadCsv = () => {
    const headers = ['Question', 'Answer', 'Category'];
    const rows = initialCards.map(card => {
      const escape = (text: string) => {
        if (!text) return '""';
        return `"${text.replace(/"/g, '""')}"`;
      };
      return [
        escape(card.question),
        escape(card.answer),
        escape(card.category || '')
      ].join(',');
    });
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${deckTitle || 'flashcards'}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const markCorrect = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    if (!seenCards.has(queue[0].id)) {
      setFirstTryCorrectCount(prev => prev + 1);
    }
    setSeenCards(prev => new Set(prev).add(queue[0].id));

    setCompletedCount(prev => prev + 1);
    setQueue(prev => prev.slice(1));
    setIsFlipped(false);
  };

  const markIncorrect = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    setSeenCards(prev => new Set(prev).add(queue[0].id));

    setQueue(prev => {
      const current = prev[0];
      const rest = prev.slice(1);
      return [...rest, current];
    });
    setIsFlipped(false);
  };

  const toggleQcmOption = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (qcmChecked) return;
    setSelectedOptions(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const checkQcmAnswer = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedOptions.length === 0) return;
    setQcmChecked(true);
  };

  const isQcmCorrect = () => {
    if (!currentCard?.correctOptions) return false;
    if (selectedOptions.length !== currentCard.correctOptions.length) return false;
    return selectedOptions.every(opt => currentCard.correctOptions!.includes(opt));
  };

  const handleQcmNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isQcmCorrect()) {
      markCorrect();
    } else {
      markIncorrect();
    }
  };

  // Helper function to convert \( \) and \[ \] to $ and $$ for remark-math compatibility
  // This allows the app to render the math while keeping the original format for CSV export
  const formatLatexForDisplay = (text: string) => {
    if (!text) return '';
    // Replace \[ ... \] with $$ ... $$ for block math
    // We use a function replacement to avoid issues with nested groups if any (though regex is simple here)
    let formatted = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, content) => `$$${content}$$`);
    
    // Replace \( ... \) with $ ... $ for inline math
    formatted = formatted.replace(/\\\(([\s\S]*?)\\\)/g, (_, content) => `$${content}$`);
    
    return formatted;
  };

  // Completion State
  if (queue.length === 0) {
    const scorePercentage = Math.round((firstTryCorrectCount / totalCards) * 100);
    let feedbackMessage = "";
    let feedbackColor = "text-yellow-600";
    let bgColor = "bg-yellow-100";

    if (scorePercentage >= 80) {
      feedbackMessage = "Excellent work! You've mastered this material.";
      feedbackColor = "text-green-600";
      bgColor = "bg-green-100";
    } else if (scorePercentage >= 50) {
      feedbackMessage = "Good job! A little more practice and you'll have it down.";
      feedbackColor = "text-blue-600";
      bgColor = "bg-blue-100";
    } else {
      feedbackMessage = "You need to study more. Keep practicing!";
      feedbackColor = "text-red-600";
      bgColor = "bg-red-100";
    }

    return (
      <div className="w-full max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[500px] text-center p-8 animate-in zoom-in-50 duration-500">
        <div className={`w-24 h-24 ${bgColor} rounded-full flex items-center justify-center mb-6`}>
          <Trophy className={`w-12 h-12 ${feedbackColor}`} />
        </div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Session Complete!</h2>
        <div className="text-6xl font-black text-slate-800 mb-4">{scorePercentage}%</div>
        <p className="text-slate-500 mb-2 max-w-md">
          You got {firstTryCorrectCount} out of {totalCards} correct on the first try.
        </p>
        <p className={`font-medium mb-8 max-w-md ${feedbackColor}`}>
          {feedbackMessage}
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
          <button
            onClick={handleRestart}
            className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Study Again
          </button>
          
          {canRegenerate && onRegenerate && (
            <button
              onClick={onRegenerate}
              className="flex-1 px-6 py-3 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl font-medium hover:bg-amber-100 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Regenerate
            </button>
          )}

          <button
            onClick={onReset}
            className="flex-1 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
          >
            <Layers className="w-4 h-4" />
            New File
          </button>
        </div>
      </div>
    );
  }

  const currentCard = queue[0];
  const progress = (completedCount / totalCards) * 100;

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col h-full min-h-[600px]">
      {/* Header Controls */}
      <div className="flex items-center justify-between mb-6 px-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={onReset}
            className="text-sm font-medium text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition-colors"
          >
            <Layers className="w-4 h-4" />
            New
          </button>
          {canRegenerate && onRegenerate && (
            <button 
              onClick={onRegenerate}
              className="text-sm font-medium text-amber-600 hover:text-amber-700 flex items-center gap-1 transition-colors ml-2"
              title="Redo generation if content is missing or formatted poorly"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Regenerate
            </button>
          )}
          {deckTitle && (
            <span className="hidden sm:block text-sm font-semibold text-slate-300">|</span>
          )}
          {deckTitle && (
             <span className="hidden sm:block text-sm font-semibold text-slate-700 truncate max-w-[150px]">
               {deckTitle}
             </span>
          )}
        </div>

        <div className="flex items-center gap-2">
           <button 
            onClick={onSaveToLibrary}
            className={`p-2 rounded-full transition-all flex items-center gap-2 px-3
              ${isSaved 
                ? 'text-green-600 bg-green-50 cursor-default' 
                : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100 hover:shadow-sm'
              }`}
            title={isSaved ? "Saved to Library" : "Save to Library"}
            disabled={isSaved}
          >
            {isSaved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
            <span className="text-xs font-bold whitespace-nowrap">{isSaved ? 'Saved' : 'Save to Library'}</span>
          </button>

           <div className="h-4 w-[1px] bg-slate-200 mx-1"></div>

           <button 
            onClick={handleDownloadCsv}
            className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-full transition-all"
            title="Download CSV"
          >
            <FileSpreadsheet className="w-4 h-4" />
          </button>

           <button 
            onClick={handleDownloadJson}
            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-full transition-all"
            title="Download JSON"
          >
            <FileJson className="w-4 h-4" />
          </button>
          
          <button 
            onClick={handleShuffle}
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all"
            title="Shuffle Remaining Cards"
          >
            <Shuffle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mastery Progress Bar */}
      <div className="w-full h-2 bg-slate-100 rounded-full mb-8 overflow-hidden flex">
        <div 
          className="h-full bg-green-500 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
          title="Mastered"
        ></div>
         <div 
          className="h-full bg-slate-200 transition-all duration-300"
          style={{ width: `${100 - progress}%` }}
          title="Remaining"
        ></div>
      </div>

      {/* Card Container */}
      <div className="flex-1 flex flex-col justify-center perspective-1000 relative">
        {currentCard.options ? (
          // QCM View
          <div key={currentCard.id} className="w-full bg-white rounded-3xl p-8 md:p-12 flex flex-col border border-slate-100 shadow-xl relative min-h-[400px]">
             <span className="absolute top-6 left-6 text-xs font-bold tracking-wider text-indigo-500 uppercase">
                Multiple Choice
             </span>
             {currentCard.category && (
                <span className="absolute top-6 right-6 text-xs font-medium text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                  {currentCard.category}
                </span>
             )}
             <div className="w-full text-lg md:text-xl font-bold text-slate-800 leading-relaxed select-none mt-6 mb-8 text-center">
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={{ p: ({node, ...props}) => <p className="mb-4 last:mb-0" {...props} /> }}
                >
                  {formatLatexForDisplay(currentCard.question)}
                </ReactMarkdown>
             </div>

             <div className="flex flex-col gap-3 mb-8">
               {currentCard.options.map((opt, idx) => {
                 const isSelected = selectedOptions.includes(idx);
                 const isCorrectOption = currentCard.correctOptions?.includes(idx);
                 
                 let optionClass = "border-slate-200 hover:border-indigo-300 hover:bg-slate-50 text-slate-700";
                 if (isSelected) optionClass = "border-indigo-500 bg-indigo-50 text-indigo-800";
                 
                 if (qcmChecked) {
                   if (isCorrectOption) {
                     optionClass = "border-green-500 bg-green-50 text-green-800";
                   } else if (isSelected && !isCorrectOption) {
                     optionClass = "border-red-500 bg-red-50 text-red-800";
                   } else {
                     optionClass = "border-slate-200 opacity-50 text-slate-500";
                   }
                 }

                 return (
                   <button
                     key={idx}
                     onClick={(e) => toggleQcmOption(idx, e)}
                     disabled={qcmChecked}
                     className={`w-full text-left p-4 rounded-xl border-2 transition-all ${optionClass}`}
                   >
                     <ReactMarkdown
                       remarkPlugins={[remarkMath]}
                       rehypePlugins={[rehypeKatex]}
                       components={{ p: ({node, ...props}) => <span {...props} /> }}
                     >
                       {formatLatexForDisplay(opt)}
                     </ReactMarkdown>
                   </button>
                 );
               })}
             </div>

             {qcmChecked && (
               <div className={`p-4 rounded-xl mb-8 ${isQcmCorrect() ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                 <p className="font-bold mb-2">{isQcmCorrect() ? 'Correct!' : 'Incorrect.'}</p>
                 <ReactMarkdown
                   remarkPlugins={[remarkMath]}
                   rehypePlugins={[rehypeKatex]}
                 >
                   {formatLatexForDisplay(currentCard.answer)}
                 </ReactMarkdown>
               </div>
             )}

             <div className="mt-auto flex justify-center">
               {!qcmChecked ? (
                 <button
                   onClick={checkQcmAnswer}
                   disabled={selectedOptions.length === 0}
                   className="w-full max-w-xs bg-indigo-600 text-white py-3 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
                 >
                   Check Answer
                 </button>
               ) : (
                 <button
                   onClick={handleQcmNext}
                   className="w-full max-w-xs bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors"
                 >
                   Next Question
                 </button>
               )}
             </div>
          </div>
        ) : (
          // Standard Flashcard View
          <div 
            className="relative w-full aspect-[4/3] cursor-pointer group"
            onClick={handleFlip}
          >
            <div 
              key={currentCard.id} /* Key forces re-render of animation when card changes */
              className={`
                w-full h-full relative transform-style-3d transition-transform duration-500 ease-in-out shadow-xl hover:shadow-2xl rounded-3xl
                ${isFlipped ? 'rotate-y-180' : ''}
              `}
            >
              {/* Front of Card (Question) */}
              <div className="absolute w-full h-full backface-hidden bg-white rounded-3xl p-8 md:p-12 flex flex-col text-center border border-slate-100">
                <span className="absolute top-6 left-6 text-xs font-bold tracking-wider text-indigo-500 uppercase">
                  Question
                </span>
                {currentCard.category && (
                  <span className="absolute top-6 right-6 text-xs font-medium text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                    {currentCard.category}
                  </span>
                )}
                
                <div className="flex-1 w-full flex flex-col items-center justify-center overflow-y-auto custom-scrollbar mt-6 mb-4">
                  <div className="w-full text-xl md:text-3xl font-bold text-slate-800 leading-relaxed select-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={{
                        p: ({node, ...props}) => <p className="mb-4 last:mb-0" {...props} />
                      }}
                    >
                      {formatLatexForDisplay(currentCard.question)}
                    </ReactMarkdown>
                  </div>
                </div>
                
                <p className="shrink-0 text-sm text-slate-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  Tap to reveal answer
                </p>
              </div>

              {/* Back of Card (Answer) */}
              <div className="absolute w-full h-full backface-hidden rotate-y-180 bg-slate-900 rounded-3xl p-8 md:p-12 flex flex-col text-center text-white">
                <span className="absolute top-6 left-6 text-xs font-bold tracking-wider text-slate-400 uppercase">
                  Answer
                </span>
                
                <div className="flex-1 w-full flex flex-col items-center justify-center overflow-y-auto custom-scrollbar mt-6 mb-4">
                  <div className="w-full text-lg md:text-2xl font-medium leading-relaxed select-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={{
                        p: ({node, ...props}) => <p className="mb-4 last:mb-0" {...props} />
                      }}
                    >
                      {formatLatexForDisplay(currentCard.answer)}
                    </ReactMarkdown>
                  </div>
                </div>
                
                {/* Study Controls - Only visible on back */}
                <div className="shrink-0 flex gap-4 w-full justify-center">
                   <button
                     onClick={markIncorrect}
                     className="flex-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-200 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all hover:scale-105"
                   >
                     <Repeat className="w-4 h-4" />
                     Needs Review
                   </button>
                   <button
                     onClick={markCorrect}
                     className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-900/20 transition-all hover:scale-105"
                   >
                     <Check className="w-5 h-5" />
                     Got it
                   </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Instructions Footer */}
      <div className="mt-8 text-center text-slate-400 text-sm">
        {currentCard.options ? (
          <p>{qcmChecked ? 'Review explanation and continue' : 'Select one or more options'}</p>
        ) : !isFlipped ? (
           <p>Tap card to show answer</p>
        ) : (
           <p>Rate your knowledge to continue</p>
        )}
      </div>
    </div>
  );
};

export default FlashcardDeck;