import { useCallback, useState, type ReactNode } from "react";
import { DestructiveConfirmDialog } from "@/components/common/DestructiveConfirmDialog";

export interface DestructiveConfirmRequest {
  targetId: string;
  label?: string;
  title?: string;
  actionName?: string;
  confirmButtonLabel?: string;
  onConfirm: () => void | Promise<void>;
}

interface PendingConfirm extends DestructiveConfirmRequest {
  label: string;
  title: string;
  actionName: string;
  confirmButtonLabel: string;
}

export interface UseDestructiveConfirmResult {
  requestConfirm: (request: DestructiveConfirmRequest) => void;
  closeConfirm: () => void;
  isConfirming: boolean;
  confirmDialog: ReactNode;
}

export function useDestructiveConfirm(): UseDestructiveConfirmResult {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const closeConfirm = useCallback(() => {
    if (isConfirming) {
      return;
    }
    setPending(null);
  }, [isConfirming]);

  const requestConfirm = useCallback((request: DestructiveConfirmRequest) => {
    setPending({
      ...request,
      label: request.label ?? request.targetId,
      title: request.title ?? "삭제 확인",
      actionName: request.actionName ?? "삭제",
      confirmButtonLabel: request.confirmButtonLabel ?? "삭제",
    });
  }, []);

  const handleConfirm = useCallback(
    async (targetId: string) => {
      if (!pending || pending.targetId !== targetId || isConfirming) {
        return;
      }

      setIsConfirming(true);
      try {
        await pending.onConfirm();
        setPending(null);
      } finally {
        setIsConfirming(false);
      }
    },
    [isConfirming, pending],
  );

  const confirmDialog = (
    <DestructiveConfirmDialog
      targetId={pending?.targetId ?? null}
      label={pending?.label}
      title={pending?.title}
      actionName={pending?.actionName}
      confirmButtonLabel={pending?.confirmButtonLabel}
      isSubmitting={isConfirming}
      onClose={closeConfirm}
      onConfirm={(id) => {
        void handleConfirm(id);
      }}
    />
  );

  return {
    requestConfirm,
    closeConfirm,
    isConfirming,
    confirmDialog,
  };
}
