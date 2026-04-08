import React, { useState, useRef } from 'react';
import { Upload, FileText, Loader2, AlertCircle, X, Plus, Layers, FileJson, Image as ImageIcon, MessageSquare, CheckSquare } from 'lucide-react';
import { DeckType } from '../types';

interface FileUploadProps {
  onFilesSelect: (files: File[], instructions: string, deckType: DeckType) => void;
  isLoading: boolean;
  error?: string | null;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFilesSelect, isLoading, error }) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [instructions, setInstructions] = useState('');
  const [deckType, setDeckType] = useState<DeckType>(DeckType.FLASHCARDS);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isLoading) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isLoading) return;
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter(file => 
      file.type === 'application/pdf' || 
      file.type === 'application/json' ||
      file.type.startsWith('image/') ||
      file.name.endsWith('.pdf') || 
      file.name.endsWith('.json') ||
      /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(file.name)
    );

    if (validFiles.length === 0 && newFiles.length > 0) {
      alert('Please upload valid PDF files, Images, or a JSON flashcard deck.');
      return;
    }
    
    const uniqueFiles = validFiles.filter(newFile => 
      !selectedFiles.some(existing => 
        existing.name === newFile.name && existing.size === newFile.size
      )
    );

    setSelectedFiles(prev => [...prev, ...uniqueFiles]);
  };

  const removeFile = (indexToRemove: number) => {
    setSelectedFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleGenerate = () => {
    if (selectedFiles.length > 0) {
      onFilesSelect(selectedFiles, instructions, deckType);
    }
  };

  const triggerFileInput = () => {
    if (!isLoading) fileInputRef.current?.click();
  };

  const isJsonDeck = selectedFiles.some(f => f.name.endsWith('.json'));

  const getFileIcon = (file: File) => {
    if (file.name.endsWith('.json')) return <FileJson className="w-4 h-4" />;
    if (file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(file.name)) return <ImageIcon className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  const getFileColorClass = (file: File) => {
    if (file.name.endsWith('.json')) return 'bg-yellow-50 text-yellow-500';
    if (file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(file.name)) return 'bg-purple-50 text-purple-500';
    return 'bg-red-50 text-red-500';
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-6">
      {/* Drop Zone */}
      <div
        className={`relative border-2 border-dashed rounded-2xl p-8 transition-all duration-300 ease-in-out text-center cursor-pointer overflow-hidden
          ${isDragging 
            ? 'border-indigo-500 bg-indigo-50 scale-[1.02]' 
            : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50 bg-white'
          }
          ${isLoading ? 'opacity-50 pointer-events-none' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerFileInput}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".pdf,.json,.jpg,.jpeg,.png,.webp,.heic,.heif,application/pdf,application/json,image/*"
          multiple
          onChange={handleFileInput}
        />

        <div className="flex flex-col items-center justify-center space-y-4">
          <div className={`p-4 rounded-full ${isDragging ? 'bg-indigo-100' : 'bg-slate-100'}`}>
            {isLoading ? (
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            ) : (
              <Upload className={`w-8 h-8 ${isDragging ? 'text-indigo-600' : 'text-slate-400'}`} />
            )}
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-slate-700">
              {isLoading ? 'Processing Documents...' : 'Upload PDFs, Images, or Deck'}
            </h3>
            <p className="text-sm text-slate-500 max-w-xs mx-auto">
              {isLoading 
                ? 'Gemini is analyzing your files and creating flashcards.' 
                : 'Drag and drop PDF files, Images, or a saved JSON deck here.'}
            </p>
          </div>
        </div>
      </div>

      {/* Options - Only show if content files (not just JSON) are selected */}
      {selectedFiles.length > 0 && !isJsonDeck && !isLoading && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
          {/* Deck Type Selection */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
              <CheckSquare className="w-4 h-4 text-indigo-500" />
              Deck Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setDeckType(DeckType.FLASHCARDS)}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border text-sm font-medium transition-all ${
                  deckType === DeckType.FLASHCARDS 
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Layers className="w-4 h-4" />
                Flashcards
              </button>
              <button
                onClick={() => setDeckType(DeckType.QCM)}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border text-sm font-medium transition-all ${
                  deckType === DeckType.QCM 
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <CheckSquare className="w-4 h-4" />
                QCM (Multiple Choice)
              </button>
            </div>
          </div>

          {/* Custom Instructions */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <label htmlFor="instructions" className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
              <MessageSquare className="w-4 h-4 text-indigo-500" />
              Custom Instructions (Optional)
            </label>
            <textarea
              id="instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g., focus on mathematical formulas, translate to French, or explain key concepts in detail..."
              className="w-full min-h-[100px] px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none transition-all placeholder:text-slate-400"
            />
          </div>
        </div>
      )}

      {/* Selected Files List */}
      {selectedFiles.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in slide-in-from-bottom-2">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Selected Files ({selectedFiles.length})
            </h4>
            {!isLoading && (
              <button 
                onClick={triggerFileInput}
                className="text-indigo-600 hover:text-indigo-700 text-xs font-medium flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add more
              </button>
            )}
          </div>
          <ul className="divide-y divide-slate-100">
            {selectedFiles.map((file, index) => (
              <li key={`${file.name}-${index}`} className="px-4 py-3 flex items-center justify-between group hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className={`p-2 rounded-lg shrink-0 ${getFileColorClass(file)}`}>
                    {getFileIcon(file)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
                    <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                {!isLoading && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                    className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-all"
                    title="Remove file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Generate Button */}
      {selectedFiles.length > 0 && !isLoading && (
        <button
          onClick={handleGenerate}
          className={`w-full py-4 bg-gradient-to-r text-white rounded-xl font-bold shadow-lg transition-all active:scale-[0.99] flex items-center justify-center gap-2
             ${isJsonDeck 
               ? 'from-emerald-500 to-teal-500 shadow-emerald-200 hover:shadow-xl' 
               : 'from-indigo-600 to-purple-600 shadow-indigo-200 hover:shadow-xl hover:scale-[1.01]'
             }
          `}
        >
          {isJsonDeck ? (
             <>
               <FileJson className="w-5 h-5" />
               Load Saved Deck
             </>
          ) : (
             <>
               <Layers className="w-5 h-5" />
               Generate {deckType === DeckType.QCM ? 'QCM' : 'Flashcards'}
             </>
          )}
        </button>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700 animate-in fade-in slide-in-from-bottom-2">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}
    </div>
  );
};

export default FileUpload;