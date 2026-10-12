import { useCallback, useEffect, useState } from 'react';
import { messageErreur } from '@/api/client';

/** Charge une liste depuis l'API, avec état de chargement, erreur et rechargement. */
export function useListe<T>(charger: () => Promise<T[]>) {
  const [elements, setElements] = useState<T[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const recharger = useCallback(() => {
    setChargement(true);
    setErreur(null);
    charger()
      .then(setElements)
      .catch((e) => setErreur(messageErreur(e, 'La liste n’a pas pu être chargée.')))
      .finally(() => setChargement(false));
  }, [charger]);

  useEffect(recharger, [recharger]);

  return { elements, chargement, erreur, recharger };
}

/** Comparaison sans tenir compte des majuscules ni des accents. */
export const normaliser = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
