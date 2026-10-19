import { useEffect, useRef } from 'react';

/**
 * useModalBack
 *
 * Ensures that when a modal, sheet, or drawer is open:
 * 1. Pressing the Escape key closes the modal cleanly.
 * 2. Avoids asynchronous history/popstate race conditions that can auto-dismiss modals on mount.
 */
export function useModalBack(isOpen: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);
}
