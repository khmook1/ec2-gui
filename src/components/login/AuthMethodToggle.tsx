import type { Ec2AuthMethod } from "@/types/connection";

interface AuthMethodToggleProps {
  value: Ec2AuthMethod;
  disabled?: boolean;
  onChange: (method: Ec2AuthMethod) => void;
}

const OPTIONS: { method: Ec2AuthMethod; label: string }[] = [
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
