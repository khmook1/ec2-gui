import type { ReactNode } from "react";
import { getAppName } from "@/lib/env";

interface AppIntroProps {
  subtitle: ReactNode;
  eyebrow?: string;
  /** 로그인 카드 등 부모 스코프가 subtitle 스타일을 주지 않을 때 사용 */
  subtitleClassName?: string;
}

export function AppIntro({ eyebrow, subtitle, subtitleClassName }: AppIntroProps) {
  return (
    <>
      {eyebrow ? <p className="login-card__eyebrow">{eyebrow}</p> : null}
      <h1>{getAppName()}</h1>
      <p className={subtitleClassName}>{subtitle}</p>
    </>
  );
}
