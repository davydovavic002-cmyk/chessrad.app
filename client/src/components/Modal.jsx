import { createPortal } from 'react-dom';

/**
 * Renders modals on document.body so they never sit under page stacking contexts.
 */
export default function Modal({ open, onClose, children, contentClassName = '', dark = false }) {
  if (!open) return null;

  return createPortal(
    <div
      className={`app-modal-overlay${dark ? ' app-modal-overlay--dark' : ''}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`app-modal-panel${dark ? ' app-modal-panel--dark' : ''} ${contentClassName}`.trim()}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
