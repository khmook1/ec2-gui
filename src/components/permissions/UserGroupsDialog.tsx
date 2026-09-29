import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { AppDialog } from "@/components/common/AppDialog";
import { Button } from "@/components/common/Button";
import { FormField } from "@/components/common/FormField";
import {
  isPriorityGroup,
  isSudoGroup,
  sortGroupsByPriority,
  toCheckedList,
} from "@/components/permissions/utils/permissionUi";
import type { RemoteUser } from "@/types/permissions";
import "./css/permissions.css";

interface UserGroupsDialogProps {
  user: RemoteUser | null;
  availableGroups: string[];
  isSubmitting?: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onSubmit: (changes: { add: string[]; remove: string[] }) => void | Promise<void>;
}

interface UserGroupsFormValues {
  search: string;
  groups: string[];
}

export function UserGroupsDialog({
  user,
  availableGroups,
  isSubmitting = false,
  errorMessage = null,
  onClose,
  onSubmit,
}: UserGroupsDialogProps) {
  const { register, handleSubmit, reset, watch } =
    useForm<UserGroupsFormValues>({
      defaultValues: { search: "", groups: [] },
    });

  useEffect(() => {
    reset({ search: "", groups: user?.groups ?? [] });
  }, [user, reset]);

  const search = watch("search").trim().toLowerCase();
  const selected = toCheckedList(watch("groups"));
  const primaryGroup = user?.groups[0] ?? null;

  const options = useMemo(() => {
    const merged = new Set([...availableGroups, ...(user?.groups ?? [])]);
    return sortGroupsByPriority([...merged]);
  }, [availableGroups, user]);

  const visibleOptions = search
    ? options.filter((group) => group.toLowerCase().includes(search))
    : options;

  if (!user) {
    return null;
  }

  const original = new Set(user.groups);

  function isLocked(group: string): string | null {
    if (group === primaryGroup) {
      return "기본 그룹은 제거할 수 없습니다";
    }
    if (user?.isCurrent && isSudoGroup(group) && original.has(group)) {
      return "현재 접속 계정의 sudo 그룹은 제거할 수 없습니다";
    }
    return null;
  }

  // disabled 체크박스는 react-hook-form 값에서 빠지므로 잠긴 그룹은 유지된 것으로 본다.
  const lockedKept = user.groups.filter((group) => isLocked(group) != null);
  const next = new Set([...selected, ...lockedKept]);
  const add = [...next].filter((group) => !original.has(group));
  const remove = [...original].filter((group) => !next.has(group));
  const hasChanges = add.length > 0 || remove.length > 0;

  return (
    <AppDialog
      open
      onClose={onClose}
      title="그룹 편집"
      subtitle={user.username}
      busy={isSubmitting}
      closeDisabled={isSubmitting}
      bodyClassName="perm-dialog__body"
    >
      <form
        className="perm-dialog"
        onSubmit={handleSubmit(async () => {
          if (!hasChanges || isSubmitting) {
            return;
          }
          await onSubmit({ add, remove });
        })}
      >
        <FormField label="그룹 검색" width="wide">
          <input
            type="search"
            autoComplete="off"
            spellCheck={false}
            placeholder="예: docker"
            disabled={isSubmitting}
            {...register("search")}
          />
        </FormField>

        <div className="perm-dialog__checklist" role="group" aria-label="그룹">
          {visibleOptions.map((group) => {
            const lockedReason = isLocked(group);
            return (
              <label
                key={group}
                className={[
                  "perm-dialog__check",
                  isPriorityGroup(group) ? "perm-dialog__check--priority" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                title={lockedReason ?? undefined}
              >
                <input
                  type="checkbox"
                  value={group}
                  disabled={isSubmitting || lockedReason != null}
                  {...register("groups")}
                />
                <span>{group}</span>
              </label>
            );
          })}
          {visibleOptions.length === 0 ? (
            <p className="perm-dialog__hint">일치하는 그룹이 없습니다.</p>
          ) : null}
        </div>

        {hasChanges ? (
          <p className="perm-dialog__hint">
            {add.length > 0 ? `추가: ${add.join(", ")}` : null}
            {add.length > 0 && remove.length > 0 ? " · " : null}
            {remove.length > 0 ? `제거: ${remove.join(", ")}` : null}
          </p>
        ) : null}
        <p className="perm-dialog__hint">
          그룹 변경은 해당 사용자가 다시 로그인한 뒤 적용됩니다.
        </p>

        {errorMessage ? (
          <p className="perm-dialog__error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className="perm-dialog__actions">
          <Button
            type="button"
            variant="ghost"
            disabled={isSubmitting}
            onClick={onClose}
          >
            취소
          </Button>
          <Button type="submit" disabled={!hasChanges || isSubmitting}>
            {isSubmitting ? "저장 중…" : "저장"}
          </Button>
        </div>
      </form>
    </AppDialog>
  );
}
