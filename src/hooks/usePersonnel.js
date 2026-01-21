import { useState, useEffect } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  where,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook to fetch all personnel records with real-time updates
 */
export function usePersonnel() {
  const [personnel, setPersonnel] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const q = query(
      collection(db, 'personnel'),
      orderBy('lastName', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const personnelData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setPersonnel(personnelData);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching personnel:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  return { personnel, loading, error };
}

/**
 * Hook for personnel CRUD operations
 */
export function usePersonnelActions() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Create a single personnel record
   */
  async function createPersonnel(personnelData) {
    setLoading(true);
    setError(null);
    try {
      const docRef = await addDoc(collection(db, 'personnel'), {
        ...personnelData,
        importedBy: user.uid,
        importedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setLoading(false);
      return docRef.id;
    } catch (err) {
      console.error('Error creating personnel:', err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }

  /**
   * Update a personnel record
   */
  async function updatePersonnel(personnelId, updates) {
    setLoading(true);
    setError(null);
    try {
      await updateDoc(doc(db, 'personnel', personnelId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      setLoading(false);
    } catch (err) {
      console.error('Error updating personnel:', err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }

  /**
   * Delete a personnel record
   */
  async function deletePersonnel(personnelId) {
    setLoading(true);
    setError(null);
    try {
      await deleteDoc(doc(db, 'personnel', personnelId));
      setLoading(false);
    } catch (err) {
      console.error('Error deleting personnel:', err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }

  /**
   * Import multiple personnel records from CSV
   * Updates existing records (by email) or creates new ones
   */
  async function importPersonnel(personnelArray) {
    setLoading(true);
    setError(null);

    const importRecord = {
      uploadedBy: user.uid,
      uploadedAt: serverTimestamp(),
      recordsProcessed: 0,
      recordsFailed: 0,
      errors: [],
      status: 'processing',
    };

    try {
      // Check for existing personnel by email
      const batch = writeBatch(db);
      let processedCount = 0;
      let failedCount = 0;
      const errors = [];

      for (let i = 0; i < personnelArray.length; i++) {
        try {
          const person = personnelArray[i];

          // Check if personnel with this email already exists
          const q = query(
            collection(db, 'personnel'),
            where('email', '==', person.email)
          );
          const existingDocs = await getDocs(q);

          if (existingDocs.empty) {
            // Create new personnel record
            const newDocRef = doc(collection(db, 'personnel'));
            batch.set(newDocRef, {
              ...person,
              importedBy: user.uid,
              importedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } else {
            // Update existing personnel record
            const existingDoc = existingDocs.docs[0];
            batch.update(doc(db, 'personnel', existingDoc.id), {
              ...person,
              updatedAt: serverTimestamp(),
            });
          }

          processedCount++;
        } catch (err) {
          failedCount++;
          errors.push({
            row: i + 2, // +2 because CSV has header row and is 1-indexed
            error: err.message,
          });
        }
      }

      // Commit the batch
      await batch.commit();

      // Create import record
      const importRecordRef = await addDoc(collection(db, 'personnelImports'), {
        ...importRecord,
        recordsProcessed: processedCount,
        recordsFailed: failedCount,
        errors,
        status: 'completed',
      });

      setLoading(false);

      return {
        importId: importRecordRef.id,
        recordsProcessed: processedCount,
        recordsFailed: failedCount,
        errors,
      };
    } catch (err) {
      console.error('Error importing personnel:', err);
      setError(err.message);
      setLoading(false);

      // Record failed import
      await addDoc(collection(db, 'personnelImports'), {
        ...importRecord,
        status: 'failed',
        errors: [{ row: 0, error: err.message }],
      });

      throw err;
    }
  }

  /**
   * Link a personnel record to a Firebase Auth user
   */
  async function linkPersonnelToUser(personnelId, userId) {
    setLoading(true);
    setError(null);
    try {
      await updateDoc(doc(db, 'personnel', personnelId), {
        userId,
        updatedAt: serverTimestamp(),
      });
      setLoading(false);
    } catch (err) {
      console.error('Error linking personnel to user:', err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }

  return {
    createPersonnel,
    updatePersonnel,
    deletePersonnel,
    importPersonnel,
    linkPersonnelToUser,
    loading,
    error,
  };
}

/**
 * Hook to get import history
 */
export function usePersonnelImports() {
  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const q = query(
      collection(db, 'personnelImports'),
      orderBy('uploadedAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const importsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setImports(importsData);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching personnel imports:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  return { imports, loading, error };
}
