import { collection, doc, setDoc, getDocs, deleteDoc, query, where, writeBatch, updateDoc } from 'firebase/firestore';
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
      const q2 = query(collection(db, 'decks'), where('collaborators', 'array-contains', email));
      const querySnapshot2 = await getDocs(q2);
      querySnapshot2.forEach((doc) => {
        decksMap.set(doc.id, doc.data() as Deck);
      });
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
      const q2 = query(collection(db, 'categories'), where('collaborators', 'array-contains', email));
      const querySnapshot2 = await getDocs(q2);
      querySnapshot2.forEach((doc) => {
        categoriesMap.set(doc.id, doc.data() as Category);
      });
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

    // 1. Update the category
    const catRef = doc(db, 'categories', categoryId);
    
    // We need to fetch the current category to append to collaborators
    const qCat = query(collection(db, 'categories'), where('id', '==', categoryId));
    const catSnap = await getDocs(qCat);
    let currentCollaborators: string[] = [];
    catSnap.forEach(d => {
      const data = d.data() as Category;
      if (data.collaborators) {
        currentCollaborators = data.collaborators;
      }
    });

    if (!currentCollaborators.includes(emailToInvite)) {
      currentCollaborators.push(emailToInvite);
      await updateDoc(catRef, { collaborators: currentCollaborators });
    }

    // 2. Update all decks in this category
    const qDecks = query(collection(db, 'decks'), where('categoryId', '==', categoryId));
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