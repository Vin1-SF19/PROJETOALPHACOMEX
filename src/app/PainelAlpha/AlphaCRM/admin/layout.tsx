import type { ReactNode } from "react";

import { AdminConfigTabs } from "./AdminConfigTabs";

export default function AdminCrmLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0">
      <AdminConfigTabs />
      {children}
    </div>
  );
}
