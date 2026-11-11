import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'admission_student_id';

export function useStudentId() {
  const [savedId, setSavedId] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) || '';
  });
  const [inputId, setInputId] = useState<string>(savedId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) || '';
    setSavedId(stored);
    setInputId(stored);
  }, []);

  const validate = useCallback((val: string): boolean => {
    if (!val || val.trim().length === 0) {
      setError('Student ID is required.');
      return false;
    }
    if (val.length !== 17 || !/^[0-9]{17}$/.test(val)) {
      setError('Student ID must be exactly 17 digits (Birth Registration Number).');
      return false;
    }
    setError(null);
    return true;
  }, []);

  const save = useCallback(() => {
    const trimmed = inputId.trim();
    if (validate(trimmed)) {
      localStorage.setItem(STORAGE_KEY, trimmed);
      setSavedId(trimmed);
      setError(null);
      return true;
    }
    return false;
  }, [inputId, validate]);

  const clear = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSavedId('');
    setInputId('');
    setError(null);
  }, []);

  return {
    savedId,
    inputId,
    setInputId: (val: string) => {
      setInputId(val);
      if (error) validate(val);
    },
    save,
    clear,
    error,
    hasValidId: savedId.length === 17 && /^[0-9]{17}$/.test(savedId),
  };
}
