import { useState, useCallback } from 'react';

export function useNfcReader(onNfcRead: (nfcId: string) => void) {
  const [isReadingNfc, setIsReadingNfc] = useState(false);

  const startNfcReading = useCallback(() => {
    setIsReadingNfc(true);
  }, []);

  const stopNfcReading = useCallback(() => {
    setIsReadingNfc(false);
  }, []);

  const triggerNfcRead = useCallback((nfcId: string) => {
    setIsReadingNfc(false);
    onNfcRead(nfcId);
  }, [onNfcRead]);

  return {
    isReadingNfc,
    startNfcReading,
    stopNfcReading,
    triggerNfcRead
  };
}
