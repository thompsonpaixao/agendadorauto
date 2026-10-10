"use client";

import React from "react";
import { Modal } from "./Modal";
import { AlertTriangle, Trash2, Loader2, Info } from "lucide-react";

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  itemName?: string;
  description?: string;
  warningNote?: string;
  confirmButtonText?: string;
  isDeleting?: boolean;
}

export function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  itemName,
  description,
  warningNote,
  confirmButtonText = "Excluir Definitivamente",
  isDeleting = false,
}: ConfirmDeleteModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isDeleting) onClose();
      }}
      title={title}
      maxWidth="md"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3.5 bg-rose-50 border border-rose-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-900 space-y-1">
            <p className="font-bold">Atenção: Ação de exclusão irreversível</p>
            <p className="text-rose-800 leading-relaxed">
              {description ||
                "Tem certeza de que deseja prosseguir com a exclusão deste item? Essa operação removerá o registro e os arquivos correspondentes."}
            </p>
          </div>
        </div>

        {itemName && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
            <span className="text-slate-500 font-medium block">Item selecionado:</span>
            <span className="font-mono font-bold text-slate-800 break-all">{itemName}</span>
          </div>
        )}

        {warningNote && (
          <div className="flex items-start gap-2 text-xs text-slate-500 p-2.5 bg-slate-50 rounded-lg">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <span>{warningNote}</span>
          </div>
        )}

        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="py-2 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold disabled:opacity-50 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="py-2 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50 shadow-sm shadow-rose-500/20 cursor-pointer"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Excluindo...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>{confirmButtonText}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
