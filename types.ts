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
}

export interface Category {
  id: string;
  name: string;
}

export enum AppState {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  STUDYING = 'STUDYING',
  LIBRARY = 'LIBRARY',
  ERROR = 'ERROR'
}

export interface ProcessingStatus {
  step: string;
  progress: number;
}