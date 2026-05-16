import { useState, useEffect } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function useReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const reportsQuery = query(
      collection(db, 'reports'),
      orderBy('timestamp', 'desc'),
    );

    const unsubscribe = onSnapshot(
      reportsQuery,
      (snapshot) => {
        setReports(
          snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })),
        );
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  return { reports, loading, error };
}
