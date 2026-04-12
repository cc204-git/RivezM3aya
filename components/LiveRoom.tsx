import React, { useState, useEffect } from 'react';
import { Users, Play, Upload, CheckCircle, Trophy, ArrowRight, Home, Copy, Save } from 'lucide-react';
import { auth } from '../firebase';
import { LiveRoom as LiveRoomType, AppState, DeckType, FlashcardData, Deck } from '../types';
import { createLiveRoom, joinLiveRoom, subscribeToRoom, updateRoomDeck, startLiveRoom, submitRoomAnswer, revealRoomAnswers, nextRoomQuestion } from '../services/liveRoomService';
import { generateFlashcardsFromContent } from '../services/geminiService';
import { saveDeck } from '../services/storageService';
import FileUpload from './FileUpload';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface LiveRoomProps {
  onGoHome: () => void;
  onGoToLibrary: () => void;
}

const LiveRoom: React.FC<LiveRoomProps> = ({ onGoHome, onGoToLibrary }) => {
  const [roomId, setRoomId] = useState<string>('');
  const [room, setRoom] = useState<LiveRoomType | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [playerName, setPlayerName] = useState(auth.currentUser?.displayName || 'Player');
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<number[]>([]);
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    if (!roomId) return;
    const unsubscribe = subscribeToRoom(roomId, (updatedRoom) => {
      if (updatedRoom) {
        setRoom(updatedRoom);
        // If everyone has answered and we are in playing state, host should trigger reveal
        if (updatedRoom.status === 'playing' && updatedRoom.hostId === auth.currentUser?.uid) {
          const allAnswered = Object.values(updatedRoom.players).every(p => p.hasAnswered);
          if (allAnswered && Object.keys(updatedRoom.players).length > 0) {
            revealRoomAnswers(roomId);
          }
        }
      } else {
        setError('Room was closed or does not exist.');
        setRoom(null);
      }
    });
    return () => unsubscribe();
  }, [roomId]);

  const handleCreateRoom = async () => {
    try {
      setError(null);
      const newRoomId = await createLiveRoom();
      setRoomId(newRoomId);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    try {
      setError(null);
      await joinLiveRoom(joinCode.toUpperCase(), playerName);
      setRoomId(joinCode.toUpperCase());
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleFilesSelect = async (files: File[], instructions: string = '') => {
    setIsGenerating(true);
    setError(null);
    try {
      const contentFiles = files.filter(f => 
        f.type === 'application/pdf' || 
        f.name.endsWith('.pdf') ||
        f.type.startsWith('image/') ||
        /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(f.name)
      );

      if (contentFiles.length === 0) throw new Error("No supported files selected.");

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
             else mimeType = 'application/octet-stream';
           }
           resolve({ name: file.name, mimeType, data: base64Data });
        };
        reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
        reader.readAsDataURL(file);
      }));

      const fileData = await Promise.all(fileReadPromises);
      const result = await generateFlashcardsFromContent(fileData, instructions, DeckType.QCM, []);
      
      await updateRoomDeck(roomId, result.cards);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartGame = async () => {
    if (!room?.deck || room.deck.length === 0) return;
    await startLiveRoom(roomId);
  };

  const toggleOption = (idx: number) => {
    if (room?.status !== 'playing') return;
    const me = room.players[auth.currentUser?.uid || ''];
    if (me?.hasAnswered) return;

    if (selectedOptions.includes(idx)) {
      setSelectedOptions(selectedOptions.filter(i => i !== idx));
    } else {
      setSelectedOptions([...selectedOptions, idx]);
    }
  };

  const submitAnswer = async () => {
    if (!room || !room.deck || selectedOptions.length === 0) return;
    const currentCard = room.deck[room.currentQuestionIndex];
    
    // Check if correct
    const correctOpts = currentCard.correctOptions || [];
    const isCorrect = selectedOptions.length === correctOpts.length && 
                      selectedOptions.every(opt => correctOpts.includes(opt));
    
    await submitRoomAnswer(roomId, selectedOptions, isCorrect);
    setSelectedOptions([]);
  };

  const handleNextQuestion = async () => {
    await nextRoomQuestion(roomId);
  };

  const handleSaveDeck = async () => {
    if (!room?.deck) return;
    const newDeck: Deck = {
      id: `deck-${Date.now()}`,
      title: `Live Room QCM (${roomId})`,
      createdAt: Date.now(),
      cards: room.deck,
      type: DeckType.QCM
    };
    await saveDeck(newDeck);
    setHasSaved(true);
  };

  const formatLatexForDisplay = (text: string) => {
    if (!text) return '';
    return text.replace(/\\\((.*?)\\\)/g, '$$$1$$').replace(/\\\[(.*?)\\\]/g, '$$$$$1$$$$');
  };

  if (!room) {
    return (
      <div className="max-w-2xl mx-auto w-full p-6 animate-in fade-in duration-500">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
            Live <span className="text-indigo-600">QCM Battle</span>
          </h1>
          <p className="text-lg text-slate-500">
            Compete with your friends in real-time.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mb-6">
              <Users className="w-8 h-8 text-indigo-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Join a Room</h2>
            <p className="text-slate-500 mb-6">Enter a code to join your friends.</p>
            
            <form onSubmit={handleJoinRoom} className="w-full space-y-4">
              <input
                type="text"
                placeholder="Your Name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-center font-medium"
                required
              />
              <input
                type="text"
                placeholder="Room Code (e.g. X7K9P)"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-center font-bold uppercase tracking-widest"
                required
                maxLength={6}
              />
              <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors">
                Join Battle
              </button>
            </form>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mb-6">
              <Play className="w-8 h-8 text-purple-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Host a Room</h2>
            <p className="text-slate-500 mb-6">Create a new battle and invite friends.</p>
            
            <button onClick={handleCreateRoom} className="w-full mt-auto bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors">
              Create Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isHost = room.hostId === auth.currentUser?.uid;
  const me = room.players[auth.currentUser?.uid || ''];
  const playersList = Object.values(room.players).sort((a, b) => b.score - a.score);

  if (room.status === 'lobby') {
    return (
      <div className="max-w-4xl mx-auto w-full p-6 animate-in fade-in duration-500">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
          <div className="bg-indigo-600 p-6 sm:p-8 text-center text-white relative">
            <h2 className="text-xl sm:text-2xl font-medium opacity-90 mb-2">Room Code</h2>
            <div className="text-4xl sm:text-5xl md:text-6xl font-black tracking-wider md:tracking-widest flex items-center justify-center gap-2 sm:gap-4 break-all px-2">
              {room.id}
              <button onClick={() => navigator.clipboard.writeText(room.id)} className="p-2 hover:bg-white/20 rounded-full transition-colors shrink-0" title="Copy Code">
                <Copy className="w-6 h-6 sm:w-8 sm:h-8" />
              </button>
            </div>
          </div>
          
          <div className="p-8 grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                Players ({playersList.length})
              </h3>
              <div className="space-y-3">
                {playersList.map(p => (
                  <div key={p.uid} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-slate-700">{p.name} {p.uid === room.hostId && '(Host)'}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-4">QCM Deck</h3>
              {isHost ? (
                room.deck ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                    <p className="font-bold text-green-800 mb-1">Deck Ready!</p>
                    <p className="text-green-600 text-sm mb-6">{room.deck.length} questions generated.</p>
                    <button onClick={handleStartGame} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition-colors">
                      Start Battle
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-slate-500 mb-4 text-sm">Upload a PDF or image to generate the QCM for this battle.</p>
                    <FileUpload onFilesSelect={handleFilesSelect} isLoading={isGenerating} error={error} />
                  </div>
                )
              ) : (
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-8 text-center h-full flex flex-col items-center justify-center">
                  {room.deck ? (
                    <>
                      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                      <p className="font-bold text-slate-800">Deck is ready!</p>
                      <p className="text-slate-500 text-sm">Waiting for host to start...</p>
                    </>
                  ) : (
                    <>
                      <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                      <p className="text-slate-500">Waiting for host to generate QCM...</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (room.status === 'finished') {
    return (
      <div className="max-w-3xl mx-auto w-full p-6 animate-in zoom-in duration-500">
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-8 md:p-12 text-center">
          <Trophy className="w-20 h-20 text-yellow-500 mx-auto mb-6" />
          <h1 className="text-4xl font-black text-slate-900 mb-2">Battle Finished!</h1>
          <p className="text-slate-500 mb-10">Here are the final results.</p>

          <div className="space-y-4 mb-10">
            {playersList.map((p, idx) => (
              <div key={p.uid} className={`flex items-center justify-between p-4 rounded-2xl border ${idx === 0 ? 'bg-yellow-50 border-yellow-200' : idx === 1 ? 'bg-slate-50 border-slate-200' : idx === 2 ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-100'}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${idx === 0 ? 'bg-yellow-200 text-yellow-800' : idx === 1 ? 'bg-slate-200 text-slate-800' : idx === 2 ? 'bg-orange-200 text-orange-800' : 'bg-slate-100 text-slate-500'}`}>
                    #{idx + 1}
                  </div>
                  <span className="font-bold text-lg text-slate-800">{p.name} {p.uid === auth.currentUser?.uid && '(You)'}</span>
                </div>
                <span className="font-black text-xl text-indigo-600">{p.score} pts</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={handleSaveDeck} disabled={hasSaved} className="px-6 py-3 bg-indigo-50 text-indigo-700 rounded-xl font-bold hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
              <Save className="w-5 h-5" />
              {hasSaved ? 'Saved to Library' : 'Save QCM to Library'}
            </button>
            <button onClick={onGoHome} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
              <Home className="w-5 h-5" />
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentCard = room.deck![room.currentQuestionIndex];
  const allAnswered = Object.values(room.players).every(p => p.hasAnswered);

  return (
    <div className="max-w-4xl mx-auto w-full p-4 md:p-6 flex flex-col h-full min-h-[600px] animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg font-bold text-sm">
            Q {room.currentQuestionIndex + 1} / {room.deck!.length}
          </div>
          <div className="text-slate-500 text-sm font-medium">
            Room: <span className="text-slate-900 font-bold">{room.id}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-slate-500 font-medium uppercase">Your Score</div>
            <div className="text-xl font-black text-indigo-600">{me?.score || 0}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 flex-1">
        {/* Main QCM Area */}
        <div className="flex-1 bg-white rounded-3xl p-6 md:p-10 shadow-xl border border-slate-100 flex flex-col">
          <div className="w-full text-lg md:text-xl font-bold text-slate-800 leading-relaxed select-none mb-8 text-center break-words overflow-hidden">
            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: ({node, ...props}) => <p className="mb-4 last:mb-0" {...props} /> }}>
              {formatLatexForDisplay(currentCard.question)}
            </ReactMarkdown>
          </div>

          <div className="flex flex-col gap-3 mb-8 w-full flex-1">
            {currentCard.options?.map((opt, idx) => {
              const isSelected = me?.hasAnswered ? me.currentAnswer.includes(idx) : selectedOptions.includes(idx);
              const isCorrectOption = currentCard.correctOptions?.includes(idx);
              
              let optionClass = "border-slate-200 hover:border-indigo-300 hover:bg-slate-50 text-slate-700";
              if (isSelected) optionClass = "border-indigo-500 bg-indigo-50 text-indigo-800";
              
              if (room.status === 'revealing') {
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
                  onClick={() => toggleOption(idx)}
                  disabled={me?.hasAnswered || room.status === 'revealing'}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all break-words overflow-hidden ${optionClass}`}
                >
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: ({node, ...props}) => <span {...props} /> }}>
                    {formatLatexForDisplay(opt)}
                  </ReactMarkdown>
                </button>
              );
            })}
          </div>

          {room.status === 'revealing' && (
            <div className={`p-6 rounded-2xl mb-6 break-words overflow-hidden ${me?.isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              <p className="font-black text-lg mb-2">{me?.isCorrect ? 'Correct! +Points' : 'Incorrect.'}</p>
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {formatLatexForDisplay(currentCard.answer)}
              </ReactMarkdown>
            </div>
          )}

          <div className="mt-auto flex justify-center">
            {room.status === 'playing' ? (
              me?.hasAnswered ? (
                <div className="w-full max-w-xs bg-slate-100 text-slate-500 py-3 rounded-xl font-bold text-center flex items-center justify-center gap-2">
                  <div className="animate-spin w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full"></div>
                  Waiting for others...
                </div>
              ) : (
                <button
                  onClick={submitAnswer}
                  disabled={selectedOptions.length === 0}
                  className="w-full max-w-xs bg-indigo-600 text-white py-3 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
                >
                  Submit Answer
                </button>
              )
            ) : (
              isHost ? (
                <button
                  onClick={handleNextQuestion}
                  className="w-full max-w-xs bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                >
                  Next Question <ArrowRight className="w-5 h-5" />
                </button>
              ) : (
                <div className="w-full max-w-xs bg-slate-100 text-slate-500 py-3 rounded-xl font-bold text-center">
                  Waiting for host...
                </div>
              )
            )}
          </div>
        </div>

        {/* Sidebar: Players & Ranking */}
        <div className="w-full md:w-64 bg-white rounded-3xl p-6 shadow-xl border border-slate-100 flex flex-col h-fit">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Live Ranking
          </h3>
          <div className="space-y-3">
            {playersList.map((p, idx) => (
              <div key={p.uid} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-2">
                  <span className={`font-bold text-sm ${idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-slate-400' : idx === 2 ? 'text-orange-400' : 'text-slate-300'}`}>
                    #{idx + 1}
                  </span>
                  <span className="font-medium text-slate-700 text-sm truncate max-w-[80px]" title={p.name}>{p.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {room.status === 'playing' && p.hasAnswered && (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  )}
                  <span className="font-bold text-indigo-600 text-sm">{p.score}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveRoom;
