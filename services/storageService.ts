import { collection, doc, setDoc, getDocs, getDoc, deleteDoc, query, where, writeBatch, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Deck, Category } from "../types";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email || undefined,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId || undefined,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  
  if (errInfo.error.includes('Missing or insufficient permissions')) {
    console.error('Firestore Security Rules Error. Please update your rules in the Firebase Console.', JSON.stringify(errInfo, null, 2));
  } else {
    console.error('Firestore Error: ', JSON.stringify(errInfo, null, 2));
  }
  
  throw new Error(JSON.stringify(errInfo));
}

export const getDecks = async (): Promise<Deck[]> => {
  try {
    const userId = auth.currentUser?.uid;
    const email = auth.currentUser?.email;
    if (!userId) return [];

    const decksMap = new Map<string, Deck>();

    // Fetch owned decks
    const q1 = query(collection(db, 'decks'), where('userId', '==', userId));
    const querySnapshot1 = await getDocs(q1);
    querySnapshot1.forEach((doc) => {
      decksMap.set(doc.id, doc.data() as Deck);
    });

    // Fetch shared decks
    if (email) {
      try {
        const q2 = query(collection(db, 'decks'), where('collaborators', 'array-contains', email));
        const querySnapshot2 = await getDocs(q2);
        querySnapshot2.forEach((doc) => {
          decksMap.set(doc.id, doc.data() as Deck);
        });
      } catch (sharedError) {
        console.warn("Could not fetch shared decks. You may need to update your Firestore Security Rules to allow reading where 'collaborators' array-contains your email.", sharedError);
      }
    }

    const decks = Array.from(decksMap.values());
    // Sort by createdAt descending
    return decks.sort((a, b) => b.createdAt - a.createdAt);
  } catch (e) {
    handleFirestoreError(e, OperationType.LIST, 'decks');
    return [];
  }
};

export const saveDeck = async (deck: Deck): Promise<void> => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("User not authenticated");

    const deckRef = doc(db, 'decks', deck.id);
    await setDoc(deckRef, { ...deck, userId });
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `decks/${deck.id}`);
  }
};

export const deleteDeck = async (id: string): Promise<void> => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    await deleteDoc(doc(db, 'decks', id));
  } catch (e) {
     handleFirestoreError(e, OperationType.DELETE, `decks/${id}`);
  }
};

// Category Methods

export const getCategories = async (): Promise<Category[]> => {
  try {
    const userId = auth.currentUser?.uid;
    const email = auth.currentUser?.email;
    if (!userId) return [];

    const categoriesMap = new Map<string, Category>();

    // Fetch owned categories
    const q1 = query(collection(db, 'categories'), where('userId', '==', userId));
    const querySnapshot1 = await getDocs(q1);
    querySnapshot1.forEach((doc) => {
      categoriesMap.set(doc.id, doc.data() as Category);
    });

    // Fetch shared categories
    if (email) {
      try {
        const q2 = query(collection(db, 'categories'), where('collaborators', 'array-contains', email));
        const querySnapshot2 = await getDocs(q2);
        querySnapshot2.forEach((doc) => {
          categoriesMap.set(doc.id, doc.data() as Category);
        });
      } catch (sharedError) {
        console.warn("Could not fetch shared categories. You may need to update your Firestore Security Rules.", sharedError);
      }
    }

    return Array.from(categoriesMap.values());
  } catch (e) {
    handleFirestoreError(e, OperationType.LIST, 'categories');
    return [];
  }
};

export const saveCategory = async (category: Category): Promise<void> => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const catRef = doc(db, 'categories', category.id);
    await setDoc(catRef, { ...category, userId });
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `categories/${category.id}`);
  }
};

export const shareCategory = async (categoryId: string, emailToInvite: string): Promise<void> => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    // We need to fetch the current category to append to collaborators
    const catRef = doc(db, 'categories', categoryId);
    const catSnap = await getDoc(catRef);
    
    let currentCollaborators: string[] = [];
    if (catSnap.exists()) {
      const data = catSnap.data() as Category;
      if (data.collaborators) {
        currentCollaborators = data.collaborators;
      }
    }

    if (!currentCollaborators.includes(emailToInvite)) {
      currentCollaborators.push(emailToInvite);
      await updateDoc(catRef, { collaborators: currentCollaborators });
    }

    // 2. Update all decks in this category that the user owns
    const qDecks = query(collection(db, 'decks'), where('categoryId', '==', categoryId), where('userId', '==', userId));
    const decksSnap = await getDocs(qDecks);
    
    if (!decksSnap.empty) {
      const batch = writeBatch(db);
      decksSnap.forEach((deckDoc) => {
        const deckData = deckDoc.data() as Deck;
        const deckCollabs = deckData.collaborators || [];
        if (!deckCollabs.includes(emailToInvite)) {
          batch.update(doc(db, 'decks', deckDoc.id), { 
            collaborators: [...deckCollabs, emailToInvite] 
          });
        }
      });
      await batch.commit();
    }
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `categories/${categoryId}/share`);
  }
};
export const deleteCategory = async (id: string): Promise<void> => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    // Delete the category
    await deleteDoc(doc(db, 'categories', id));
    
    // Also remove this category from any decks using it
    const q = query(collection(db, 'decks'), where('userId', '==', userId), where('categoryId', '==', id));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const batch = writeBatch(db);
      querySnapshot.forEach((deckDoc) => {
        const deckRef = doc(db, 'decks', deckDoc.id);
        batch.update(deckRef, { categoryId: null });
      });
      await batch.commit();
    }
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `categories/${id}`);
  }
};

import { UserProfile } from '../types';

export const getUserProfile = async (): Promise<UserProfile | null> => {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    } else {
      const newProfile: UserProfile = { uid: user.uid, email: user.email || '', acceptedCategories: [], hasSeenOnboarding: false };
      await setDoc(ref, newProfile);
      return newProfile;
    }
  } catch (e) {
    handleFirestoreError(e, OperationType.GET, `users/${auth.currentUser?.uid}`);
    return null;
  }
};

export const markOnboardingSeen = async (): Promise<void> => {
  try {
    const user = auth.currentUser;
    if (!user) return;
    const ref = doc(db, 'users', user.uid);
    await updateDoc(ref, { hasSeenOnboarding: true });
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `users/${auth.currentUser?.uid}`);
  }
};

export const acceptCategoryShare = async (categoryId: string): Promise<void> => {
  try {
    const user = auth.currentUser;
    if (!user) return;
    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data() as UserProfile;
      if (!data.acceptedCategories.includes(categoryId)) {
        await updateDoc(ref, { acceptedCategories: [...data.acceptedCategories, categoryId] });
      }
    }
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `users/${auth.currentUser?.uid}`);
  }
};

export const rejectCategoryShare = async (categoryId: string): Promise<void> => {
  try {
    const user = auth.currentUser;
    if (!user || !user.email) return;
    
    const catRef = doc(db, 'categories', categoryId);
    const catSnap = await getDoc(catRef);
    if (catSnap.exists()) {
      const data = catSnap.data() as Category;
      if (data.collaborators) {
        const newCollabs = data.collaborators.filter(e => e !== user.email);
        await updateDoc(catRef, { collaborators: newCollabs });
      }
    }

    const qDecks = query(collection(db, 'decks'), where('categoryId', '==', categoryId), where('collaborators', 'array-contains', user.email));
    const decksSnap = await getDocs(qDecks);
    if (!decksSnap.empty) {
      const batch = writeBatch(db);
      decksSnap.forEach(deckDoc => {
        const deckData = deckDoc.data() as Deck;
        if (deckData.collaborators) {
          const newCollabs = deckData.collaborators.filter(e => e !== user.email);
          batch.update(doc(db, 'decks', deckDoc.id), { collaborators: newCollabs });
        }
      });
      await batch.commit();
    }
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `categories/${categoryId}/reject`);
  }
};