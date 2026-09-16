import { Button, type ButtonProps } from "@/components/common/Button";

export type DangerButtonProps = ButtonProps;

/** 삭제·강제 삭제·강제 종료 등 위험 동작용 버튼 */
export function DangerButton({
  className,
  variant = "ghost",
  type = "button",
  ...rest
}: DangerButtonProps) {
  const classes = ["btn--danger", className].filter(Boolean).join(" ");

  return <Button type={type} variant={variant} className={classes} {...rest} />;
}
