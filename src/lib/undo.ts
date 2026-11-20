// Canal minimal pour le bandeau « Annuler » affiché après une suppression.
type Listener = (msg: { label: string; trashId: string }) => void;
const listeners = new Set<Listener>();

export function onUndoOffer(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function offerUndo(label: string, trashId: string) {
  listeners.forEach((cb) => cb({ label, trashId }));
}
