import type { SshAuthMethod } from "@/types/connection";
import "./css/auth-method-toggle.css";

interface AuthMethodToggleProps {
  value: SshAuthMethod;
  disabled?: boolean;
  onChange: (method: SshAuthMethod) => void;
}

const OPTIONS: { method: SshAuthMethod; label: string }[] = [
  { method: "password", label: "비밀번호" },
  { method: "pem", label: "PEM 키" },
];

export function AuthMethodToggle({
  value,
  disabled,
  onChange,
}: AuthMethodToggleProps) {
  return (
    <div className="login-auth-toggle" role="tablist" aria-label="인증 방식">
      {OPTIONS.map(({ method, label }) => {
        const isActive = value === method;
        return (
          <button
            key={method}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={
              isActive
                ? "login-auth-toggle__item login-auth-toggle__item--active"
                : "login-auth-toggle__item"
            }
            disabled={disabled}
            onClick={() => onChange(method)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
