import type { ImgHTMLAttributes, CSSProperties } from "react";
import { getAppName } from "@/lib/env";

export interface LogoIconProps
  extends Omit<
    ImgHTMLAttributes<HTMLImageElement>,
    "src" | "width" | "height" | "alt"
  > {
  /** 아이콘 한 변 길이(px). 헤더·사이드바 등에서 각각 다르게 지정 */
  size?: number;
  alt?: string;
}

export function LogoIcon({
  size = 40,
  className,
  alt,
  style,
  ...rest
}: LogoIconProps) {
  const classes = ["logo-icon", className].filter(Boolean).join(" ");
  const mergedStyle = {
    ...style,
    "--logo-size": `${size}px`,
  } as CSSProperties;

  return (
    <img
      className={classes}
      src="/app-icon.png"
      alt={alt ?? getAppName()}
      width={size}
      height={size}
      draggable={false}
      style={mergedStyle}
      {...rest}
    />
  );
}
