import type { ReactNode } from "react";
import { ContextMenuProvider } from "@/providers/ContextMenuProvider";
import { ListSearchProvider } from "@/providers/ListSearchProvider";

interface ContentLayoutProps {
  children: ReactNode;
}

export function ContentLayout({ children }: ContentLayoutProps) {
  return (
    <div className="content-layout">
      <ContextMenuProvider>
        <ListSearchProvider>{children}</ListSearchProvider>
      </ContextMenuProvider>
    </div>
  );
}
