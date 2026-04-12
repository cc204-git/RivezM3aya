import { doc, setDoc, getDoc, updateDoc, onSnapshot, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { LiveRoom, FlashcardData, LiveRoomPlayer } from '../types';

const generateRoomCode = () => {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
};

export const createLiveRoom = async (): Promise<string> => {
  if (!auth.currentUser) throw new Error("Must be logged in to create a room");
  
  const roomId = generateRoomCode();
  const roomRef = doc(db, 'liveRooms', roomId);
  
  const newRoom: LiveRoom = {
    id: roomId,
    hostId: auth.currentUser.uid,
    status: 'lobby',
    deck: null,
    currentQuestionIndex: 0,
    players: {
      [auth.currentUser.uid]: {
        uid: auth.currentUser.uid,
        name: auth.currentUser.displayName || 'Host',
        score: 0,
        hasAnswered: false,
        currentAnswer: [],
        isCorrect: false,
        answerTimestamp: 0
      }
    },
    createdAt: Date.now()
  };
  
  await setDoc(roomRef, newRoom);
  return roomId;
};

export const joinLiveRoom = async (roomId: string, playerName: string): Promise<void> => {
  if (!auth.currentUser) throw new Error("Must be logged in to join a room");
  
  const roomRef = doc(db, 'liveRooms', roomId);
  const roomSnap = await getDoc(roomRef);
  
  if (!roomSnap.exists()) {
    throw new Error("Room not found");
  }
  
  const room = roomSnap.data() as LiveRoom;
  if (room.status !== 'lobby') {
    throw new Error("Game has already started");
  }
  
  const newPlayer: LiveRoomPlayer = {
    uid: auth.currentUser.uid,
    name: playerName,
    score: 0,
    hasAnswered: false,
    currentAnswer: [],
    isCorrect: false,
    answerTimestamp: 0
  };
  
  await updateDoc(roomRef, {
    [`players.${auth.currentUser.uid}`]: newPlayer
  });
};

export const updateRoomDeck = async (roomId: string, deck: FlashcardData[]): Promise<void> => {
  const roomRef = doc(db, 'liveRooms', roomId);
  await updateDoc(roomRef, { deck });
};

export const startLiveRoom = async (roomId: string): Promise<void> => {
  const roomRef = doc(db, 'liveRooms', roomId);
  await updateDoc(roomRef, { status: 'playing' });
};

export const submitRoomAnswer = async (roomId: string, answerIndices: number[], isCorrect: boolean): Promise<void> => {
  if (!auth.currentUser) return;
  const roomRef = doc(db, 'liveRooms', roomId);
  
  await updateDoc(roomRef, {
    [`players.${auth.currentUser.uid}.hasAnswered`]: true,
    [`players.${auth.currentUser.uid}.currentAnswer`]: answerIndices,
    [`players.${auth.currentUser.uid}.isCorrect`]: isCorrect,
    [`players.${auth.currentUser.uid}.answerTimestamp`]: Date.now()
  });
};

export const revealRoomAnswers = async (roomId: string): Promise<void> => {
  const roomRef = doc(db, 'liveRooms', roomId);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) return;
  
  const room = roomSnap.data() as LiveRoom;
  if (room.status !== 'playing') return;
  
  const updates: Record<string, any> = { status: 'revealing' };
  
  // Calculate scores
  // Base points for correct answer: 100
  // Bonus points for speed: up to 50
  const correctPlayers = Object.values(room.players).filter(p => p.isCorrect && p.hasAnswered);
  correctPlayers.sort((a, b) => a.answerTimestamp - b.answerTimestamp);
  
  Object.values(room.players).forEach(p => {
    if (p.isCorrect && p.hasAnswered) {
      let points = 100;
      const rank = correctPlayers.findIndex(cp => cp.uid === p.uid);
      if (rank === 0) points += 50;
      else if (rank === 1) points += 30;
      else if (rank === 2) points += 10;
      
      updates[`players.${p.uid}.score`] = p.score + points;
    }
  });
  
  await updateDoc(roomRef, updates);
};

export const nextRoomQuestion = async (roomId: string): Promise<void> => {
  const roomRef = doc(db, 'liveRooms', roomId);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) return;
  
  const room = roomSnap.data() as LiveRoom;
  const isFinished = room.deck && room.currentQuestionIndex >= room.deck.length - 1;
  
  const updates: Record<string, any> = {
    status: isFinished ? 'finished' : 'playing',
    currentQuestionIndex: isFinished ? room.currentQuestionIndex : room.currentQuestionIndex + 1
  };
  
  // Reset player answer states
  Object.keys(room.players).forEach(uid => {
    updates[`players.${uid}.hasAnswered`] = false;
    updates[`players.${uid}.currentAnswer`] = [];
    updates[`players.${uid}.isCorrect`] = false;
    updates[`players.${uid}.answerTimestamp`] = 0;
  });
  
  await updateDoc(roomRef, updates);
};

export const subscribeToRoom = (roomId: string, callback: (room: LiveRoom | null) => void) => {
  const roomRef = doc(db, 'liveRooms', roomId);
  return onSnapshot(roomRef, (doc) => {
    if (doc.exists()) {
      callback(doc.data() as LiveRoom);
    } else {
      callback(null);
    }
  });
};
