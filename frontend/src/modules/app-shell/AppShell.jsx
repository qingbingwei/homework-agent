import { Card, Chip, Link, Separator } from "@heroui/react";

function NavItem({ active, children, href }) {
  return (
    <Link className={`nav-item${active ? " is-active" : ""}`} href={href}>
      <span className="nav-dot" />
      {children}
    </Link>
  );
}

function formatAgentWindow(seconds) {
  if (!seconds) return "Agent window";
  return `Agent window · ${Math.round(seconds / 60)} min`;
}

export function AppShell({ agentTimeoutSeconds, children }) {
  return (
    <div className="app-shell">
      <Card className="sidebar" variant="default">
        <div className="brand-block">
          <span className="brand-mark">HA</span>
          <div>
            <strong>Homework Agent</strong>
            <span>AI Report Studio</span>
          </div>
        </div>
        <nav className="sidebar-nav" aria-label="主导航">
          <NavItem active href="#overview">总览</NavItem>
          <NavItem href="#workspace">生成工作台</NavItem>
          <NavItem href="#system">系统能力</NavItem>
          <NavItem href="#result">结果预览</NavItem>
        </nav>
        <Separator className="sidebar-separator" />
        <div className="sidebar-footer">
          <Chip color="success" size="sm" variant="soft">
            {formatAgentWindow(agentTimeoutSeconds)}
          </Chip>
          <span>Go backend serving production UI</span>
        </div>
      </Card>
      <div className="shell-main">
        <Card className="topbar-card" variant="default">
          <Card.Content className="topbar">
            <div>
              <p className="eyebrow">AI Lab Report Workspace</p>
              <h1>实验报告生成控制台</h1>
            </div>
            <div className="topbar-actions">
              <Link className="secondary-link" href="#system">查看状态</Link>
              <Link className="primary-link" href="#workspace">开始生成</Link>
            </div>
          </Card.Content>
        </Card>
        {children}
      </div>
    </div>
  );
}
