import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}

export default function Modal({ open, onClose, title, children, width = 'max-w-md' }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={v => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/20 z-40" />
        <Dialog.Content
          className={`fixed z-50 bg-surface border border-divider rounded-md shadow-lg
            top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
            w-[calc(100vw-2rem)] ${width} p-6 outline-none`}
        >
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="text-[15px] font-medium text-text">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-muted hover:text-text p-0.5 rounded">
                <X size={16} strokeWidth={1.5} />
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

