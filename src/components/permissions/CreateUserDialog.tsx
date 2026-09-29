import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { AppDialog } from "@/components/common/AppDialog";
import { Button } from "@/components/common/Button";
import { FormField } from "@/components/common/FormField";
import {
  isPriorityGroup,
  sortGroupsByPriority,
  toCheckedList,
} from "@/components/permissions/utils/permissionUi";
import "./css/permissions.css";

const USERNAME_PATTERN = /^[a-z_][a-z0-9_-]{0,31}$/;
const SSH_KEY_PATTERN = /^(ssh-|ecdsa-|sk-)\S+\s+\S+/;
const DEFAULT_SHELL = "/bin/bash";
const SHELL_OPTIONS = [DEFAULT_SHELL, "/bin/sh", "/usr/bin/zsh"];

export interface CreateUserFormResult {
  username: string;
  shell: string;
  groups: string[];
  sshPublicKey: string | null;
  grantNopasswd: boolean;
}

interface CreateUserDialogProps {
  open: boolean;
  availableGroups: string[];
  existingUsernames: string[];
  isSubmitting?: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onSubmit: (values: CreateUserFormResult) => void | Promise<void>;
}

interface CreateUserFormValues {
  username: string;
  shell: string;
  groups: string[];
  sshPublicKey: string;
  grantNopasswd: boolean;
}

const DEFAULT_VALUES: CreateUserFormValues = {
  username: "",
  shell: DEFAULT_SHELL,
  groups: [],
  sshPublicKey: "",
  grantNopasswd: false,
};

export function CreateUserDialog({
  open,
  availableGroups,
  existingUsernames,
  isSubmitting = false,
  errorMessage = null,
  onClose,
  onSubmit,
}: CreateUserDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { isValid, errors },
  } = useForm<CreateUserFormValues>({
    mode: "onChange",
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    if (open) {
      reset(DEFAULT_VALUES);
    }
  }, [open, reset]);

  /** 생성 시에는 권한과 직결된 그룹만 고르게 한다 (나머지는 그룹 편집에서). */
  const groupOptions = useMemo(
    () => sortGroupsByPriority(availableGroups.filter(isPriorityGroup)),
    [availableGroups],
  );

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="사용자 추가"
      busy={isSubmitting}
      closeDisabled={isSubmitting}
      bodyClassName="perm-dialog__body"
    >
      <form
        className="perm-dialog"
        onSubmit={handleSubmit(async (values) => {
          if (isSubmitting) {
            return;
          }
          const key = values.sshPublicKey.trim();
          await onSubmit({
            username: values.username.trim(),
            shell: values.shell,
            groups: toCheckedList(values.groups),
            sshPublicKey: key ? key : null,
            grantNopasswd: values.grantNopasswd,
          });
        })}
      >
        <FormField label="사용자 이름" width="wide">
          <input
            type="text"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            placeholder="예: deploy"
            disabled={isSubmitting}
            aria-invalid={errors.username ? true : undefined}
            {...register("username", {
              required: "사용자 이름을 입력하세요.",
              validate: (value) => {
                const name = value.trim();
                if (!USERNAME_PATTERN.test(name)) {
                  return "소문자로 시작하고 소문자/숫자/_/- 만 사용할 수 있습니다. (최대 32자)";
                }
                if (existingUsernames.includes(name)) {
                  return "이미 존재하는 사용자입니다.";
                }
                return true;
              },
            })}
          />
        </FormField>
        {errors.username?.message ? (
          <p className="perm-dialog__error" role="alert">
            {errors.username.message}
          </p>
        ) : null}

        <FormField label="로그인 셸" width="wide">
          <select disabled={isSubmitting} {...register("shell")}>
            {SHELL_OPTIONS.map((shell) => (
              <option key={shell} value={shell}>
                {shell}
              </option>
            ))}
          </select>
        </FormField>

        {groupOptions.length > 0 ? (
          <FormField label="그룹" width="wide" as="div">
            <div className="perm-dialog__checklist perm-dialog__checklist--inline">
              {groupOptions.map((group) => (
                <label key={group} className="perm-dialog__check">
                  <input
                    type="checkbox"
                    value={group}
                    disabled={isSubmitting}
                    {...register("groups")}
                  />
                  <span>{group}</span>
                </label>
              ))}
            </div>
          </FormField>
        ) : null}

        <label className="perm-dialog__check perm-dialog__check--standalone">
          <input
            type="checkbox"
            disabled={isSubmitting}
            {...register("grantNopasswd")}
          />
          <span>비밀번호 없는 sudo 권한 부여 (NOPASSWD)</span>
        </label>

        <FormField label="SSH 공개키 (선택)" width="wide">
          <textarea
            rows={4}
            spellCheck={false}
            placeholder="ssh-ed25519 AAAA... user@host"
            disabled={isSubmitting}
            aria-invalid={errors.sshPublicKey ? true : undefined}
            {...register("sshPublicKey", {
              validate: (value) => {
                const key = value.trim();
                if (!key) {
                  return true;
                }
                if (key.includes("\n")) {
                  return "공개키는 한 줄만 입력할 수 있습니다.";
                }
                return (
                  SSH_KEY_PATTERN.test(key) ||
                  "올바른 SSH 공개키 형식이 아닙니다."
                );
              },
            })}
          />
        </FormField>
        {errors.sshPublicKey?.message ? (
          <p className="perm-dialog__error" role="alert">
            {errors.sshPublicKey.message}
          </p>
        ) : (
          <p className="perm-dialog__hint">
            입력하면 ~/.ssh/authorized_keys 에 등록되어 해당 키로 접속할 수
            있습니다.
          </p>
        )}

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
          <Button type="submit" disabled={!isValid || isSubmitting}>
            {isSubmitting ? "추가 중…" : "추가"}
          </Button>
        </div>
      </form>
    </AppDialog>
  );
}
