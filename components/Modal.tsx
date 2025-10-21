"use client";

import { ReactNode, useState } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ isOpen, onClose, title, children, footer }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative card max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold neon-text">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="mb-6">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="border-t-2 border-cyan-400/30 pt-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDestructive = false,
}: ConfirmModalProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex gap-4">
          <button
            onClick={onClose}
            className="btn btn-secondary flex-1"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={`flex-1 ${
              isDestructive
                ? "bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-lg border-2 border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_30px_rgba(239,68,68,0.5)] transition-all"
                : "btn btn-primary"
            }`}
          >
            {confirmText}
          </button>
        </div>
      }
    >
      <p className="text-lg text-gray-300">{message}</p>
    </Modal>
  );
}

// Copy Button Component
interface CopyButtonProps {
  text: string;
  displayText?: string;
  className?: string;
}

export function CopyButton({ text, displayText, className = "" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-2 px-3 py-1 rounded bg-cyan-400/20 hover:bg-cyan-400/30 border border-cyan-400/50 text-cyan-400 text-xs font-bold transition-all ${className}`}
    >
      {displayText || text}
      <span className="ml-1">
        {copied ? "✓" : "📋"}
      </span>
    </button>
  );
}
