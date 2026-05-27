import { Chip, Separator } from "@heroui/react";

function NavItem({ active, children, href }) {
  return (
    <a className={`ha-nav-item${active ? " is-active" : ""}`} href={href}>
      <span className="ha-nav-dot" />
      <span>{children}</span>
    </a>
  );
}

function formatAgentWindow(seconds) {
  if (!seconds) return "Agent window";
  return `${Math.round(seconds / 60)} min`;
}

export function AppShell({ agentTimeoutSeconds, children }) {
  return (
    <div className="grid min-h-screen w-full grid-cols-[240px_minmax(0,1fr)] gap-8 py-6 pl-4 pr-6 max-[1080px]:grid-cols-1 max-[1080px]:px-4">
      {/* Sidebar */}
      <aside className="ha-glass-card sticky top-6 flex h-[calc(100vh-48px)] flex-col gap-5 p-5 max-[1080px]:static max-[1080px]:h-auto">
        <div className="flex items-center gap-3">
          <span className="ha-brand-mark text-sm">HA</span>
          <div className="grid gap-0.5 min-w-0">
            <strong className="truncate text-[15px] font-bold leading-tight">Homework Agent</strong>
            <span className="truncate text-[11px] font-medium text-[var(--muted)]">AI Report Studio</span>
          </div>
        </div>

        <nav className="grid gap-1" aria-label="主导航">
          <NavItem active href="#overview">总览</NavItem>
          <NavItem href="#workspace">生成工作台</NavItem>
          <NavItem href="#result">结果预览</NavItem>
          <NavItem href="#system">系统能力</NavItem>
        </nav>

        <Separator />

        <div className="mt-auto grid gap-2">
          <div className="flex items-center gap-2">
            <span className="ha-status-dot ha-status-dot--ok" />
            <Chip color="success" size="sm" variant="soft">
              Agent {formatAgentWindow(agentTimeoutSeconds)}
            </Chip>
          </div>
          <span className="text-[11px] leading-relaxed text-[var(--muted)]">
            Go backend · production ready
          </span>
        </div>
      </aside>

      {/* Main content */}
      <main className="mx-auto grid w-full min-w-0 max-w-[1080px] gap-6">{children}</main>
    </div>
  );
}
