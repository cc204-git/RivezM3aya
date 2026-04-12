export enum DeckType {
  FLASHCARDS = 'FLASHCARDS',
  QCM = 'QCM'
}

export interface FlashcardData {
  id: string;
  question: string;
  answer: string;
  options?: string[]; // For QCM: 4 options
  correctOptions?: number[]; // For QCM: indices of correct options (0-3)
}

export interface Deck {
  id: string;
  title: string;
  createdAt: number;
  cards: FlashcardData[];
  categoryId?: string;
  type?: DeckType;
  hasSourceFiles?: boolean;
  userId?: string;
  collaborators?: string[];
}

export interface Category {
  id: string;
  name: string;
  userId?: string;
  collaborators?: string[];
}

export interface UserProfile {
  uid: string;
  email: string;
  acceptedCategories: string[];
  hasSeenOnboarding?: boolean;
  hasSeenUpdateV2?: boolean;
}

export enum AppState {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  STUDYING = 'STUDYING',
  LIBRARY = 'LIBRARY',
  ERROR = 'ERROR',
  LIVE_ROOM = 'LIVE_ROOM'
}

export interface ProcessingStatus {
  step: string;
  progress: number;
}

export interface LiveRoomPlayer {
  uid: string;
  name: string;
  score: number;
  hasAnswered: boolean;
  currentAnswer: number[];
  isCorrect: boolean;
  answerTimestamp: number;
}

export interface LiveRoom {
  id: string;
  hostId: string;
  status: 'lobby' | 'playing' | 'revealing' | 'finished';
  deck: FlashcardData[] | null;
  currentQuestionIndex: number;
  players: Record<string, LiveRoomPlayer>;
  createdAt: number;
}