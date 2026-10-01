import { useForm } from "react-hook-form";
import { Button } from "@/components/common/Button";
import "./css/sudo-password-prompt.css";

interface SudoPasswordPromptProps {
  busy?: boolean;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}

interface SudoPasswordFormValues {
  password: string;
}

export function SudoPasswordPrompt({
  busy = false,
  onSubmit,
  onCancel,
}: SudoPasswordPromptProps) {
  const {
    register,
    handleSubmit,
    formState: { isValid },
  } = useForm<SudoPasswordFormValues>({
    mode: "onChange",
    defaultValues: { password: "" },
  });

  return (
    <form
      className="sudo-password-prompt"
      onSubmit={handleSubmit(({ password }) => {
        if (!busy) {
          onSubmit(password);
        }
      })}
    >
      <label className="sudo-password-prompt__label">
        <span>sudo 비밀번호</span>
        <input
          type="password"
          className="sudo-password-prompt__input"
          autoFocus
          autoComplete="off"
          disabled={busy}
          placeholder="현재 계정 비밀번호"
          onKeyDown={(event) => {
            // 파일 다이얼로그 전체가 닫히지 않도록 Escape 는 입력만 취소
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              onCancel();
            }
          }}
          {...register("password", { required: true })}
        />
      </label>
      <Button
        type="button"
        variant="ghost"
        className="sudo-password-prompt__button"
        disabled={busy}
        onClick={onCancel}
      >
        취소
      </Button>
      <Button
        type="submit"
        className="sudo-password-prompt__button"
        disabled={busy || !isValid}
      >
        {busy ? "저장 중…" : "sudo로 저장"}
      </Button>
    </form>
  );
}
