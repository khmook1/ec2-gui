import { useEffect, useState } from "react";

/** 목표 글자 수까지 남은 양의 1/N씩 프레임마다 따라잡는다 (큰 청크도 부드럽게 표시). */
const CATCH_UP_FRAMES = 24;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * 스트리밍 텍스트를 타자기처럼 점진적으로 노출한다.
 * 대상 텍스트가 완전히 바뀌는 경우에는 컴포넌트를 key로 다시 마운트해 초기화한다.
 */
export function useTypewriter(target: string): string {
  const [count, setCount] = useState(() => (prefersReducedMotion() ? target.length : 0));

  useEffect(() => {
    if (count >= target.length) return;
    if (prefersReducedMotion()) {
      setCount(target.length);
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      setCount((current) => {
        const remaining = target.length - current;
        return Math.min(
          target.length,
          current + Math.max(1, Math.ceil(remaining / CATCH_UP_FRAMES)),
        );
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [count, target]);

  return target.slice(0, Math.min(count, target.length));
}
