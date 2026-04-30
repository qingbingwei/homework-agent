import { Badge, Chip } from "@heroui/react";

function NavItem({ active, children, href }) {
  return (
    <a className={`nav-item${active ? " is-active" : ""}`} href={href}>
      {children}
    </a>
  );
}

export function AppShell({ children }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <Badge color="success" size="sm">
            <span className="brand-mark">HA</span>
          </Badge>
          <div>
            <strong>Homework Agent</strong>
            <span>Report Automation</span>
          </div>
        </div>
        <nav className="sidebar-nav" aria-label="主导航">
          <NavItem active href="#overview">总览</NavItem>
          <NavItem href="#workspace">生成工作台</NavItem>
          <NavItem href="#system">系统能力</NavItem>
          <NavItem href="#result">结果预览</NavItem>
        </nav>
        <div className="sidebar-footer">
          <Chip color="success" size="sm" variant="soft">30 min timeout</Chip>
          <span>Frontend served by Go backend</span>
        </div>
      </aside>
      <div className="shell-main">
        <header className="topbar">
          <div>
            <p className="eyebrow">AI Lab Report Workspace</p>
            <h1>实验报告生成控制台</h1>
          </div>
          <a className="primary-link" href="#workspace">
            开始生成
          </a>
        </header>
        {children}
      </div>
    </div>
  );
}
