import React from 'react';
import { Brain, Sparkles, Layers, BookOpen, Share2, CheckCircle, Clock, Users } from 'lucide-react';

interface OnboardingModalProps {
  onOk: () => void;
  onSeeLater: () => void;
}

const OnboardingModal: React.FC<OnboardingModalProps> = ({ onOk, onSeeLater }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden scale-100 animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
        
        {/* Scrollable Content Area */}
        <div className="overflow-y-auto flex-1">
          {/* Header */}
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
            <div className="relative z-10">
              <div className="bg-white/20 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-md border border-white/30 shadow-xl">
                <Brain className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl font-extrabold text-white mb-2 tracking-tight">What's New in Rivez M3aya!</h2>
              <p className="text-indigo-100 text-lg max-w-md mx-auto">Your AI-powered study companion just got a massive upgrade.</p>
            </div>
          </div>

          {/* Content */}
          <div className="p-8">
            <div className="grid gap-6 sm:grid-cols-2">
            
            {/* Feature 1: NEW LIVE BATTLES */}
            <div className="flex gap-4 sm:col-span-2 bg-purple-50 p-4 rounded-2xl border border-purple-100">
              <div className="shrink-0 mt-1">
                <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center shadow-lg shadow-purple-200">
                  <Users className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-lg font-bold text-slate-900">Live QCM Battles</h4>
                  <span className="bg-purple-200 text-purple-800 text-xs font-black px-2 py-0.5 rounded-full uppercase tracking-wider">New</span>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">Create a live room, invite your friends with a 5-digit code, and race to answer AI-generated questions in real-time. Earn points for correct answers and speed bonuses to top the live leaderboard!</p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="flex gap-4">
              <div className="shrink-0 mt-1">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 mb-1">AI Generation</h4>
                <p className="text-sm text-slate-600 leading-relaxed">Upload PDFs, images, or paste text. Our AI will automatically generate smart flashcards and multiple-choice questions for you.</p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="flex gap-4">
              <div className="shrink-0 mt-1">
                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100">
                  <BookOpen className="w-5 h-5 text-emerald-600" />
                </div>
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 mb-1">Study Modes</h4>
                <p className="text-sm text-slate-600 leading-relaxed">Test your knowledge with interactive flashcards or take QCM quizzes. Track your progress and master your subjects.</p>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="flex gap-4">
              <div className="shrink-0 mt-1">
                <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center border border-amber-100">
                  <Share2 className="w-5 h-5 text-amber-600" />
                </div>
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 mb-1">Collaborate</h4>
                <p className="text-sm text-slate-600 leading-relaxed">Share your categories with friends. They can accept your invitations and study the same decks together.</p>
              </div>
            </div>
          </div>
        </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row gap-3 justify-end shrink-0">
          <button
            onClick={onSeeLater}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 hover:text-slate-900 transition-colors flex items-center justify-center gap-2"
          >
            <Clock className="w-4 h-4" />
            See Later
          </button>
          <button
            onClick={onOk}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Got it, let's go!
          </button>
        </div>

      </div>
    </div>
  );
};

export default OnboardingModal;
