import { Chip } from "@heroui/react";

import { formatModelProfile } from "../../lib/modelProfiles";

function formatBytes(value) {
  if (!value) return "未知";
  return `${(value / (1024 * 1024)).toFixed(0)} MB`;
}

function StatItem({ label, value, hint }) {
  return (
    <div className="grid min-w-0 gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        {label}
      </span>
      <strong className="truncate text-[18px] font-bold leading-tight text-[var(--brand-ink)]">
        {value}
      </strong>
      {hint ? <span className="truncate text-[12px] text-[var(--muted)]">{hint}</span> : null}
    </div>
  );
}

export function SystemModule({ capabilities, health }) {
  const ok = health.status === "ok";
  const profiles = capabilities.coding_model_profiles || [];
  const templates = capabilities.template_modes || [];

  return (
    <section className="grid gap-4" id="system">
      <div className="grid gap-1">
        <p className="ha-eyebrow">System capability</p>
        <h2 className="m-0 text-[20px] font-extrabold leading-tight text-[var(--brand-ink)]">
          运行与能力概览
        </h2>
      </div>

      <div className="ha-glass-card grid gap-5 p-7">
        <div className="grid grid-cols-3 gap-5 max-[640px]:grid-cols-1">
          <StatItem
            label="服务状态"
            value={
              <span className="inline-flex items-center gap-2">
                <span className={`ha-status-dot ${ok ? "ha-status-dot--ok" : "ha-status-dot--err"}`} />
                {health.message}
              </span>
            }
            hint={health.meta}
          />
          <StatItem
            label="上传限制"
            value={formatBytes(capabilities.max_upload_bytes)}
            hint="单文件最大体积"
          />
          <StatItem
            label="模板策略"
            value={`${templates.length} 种`}
            hint={templates.join(" · ") || "—"}
          />
        </div>

        {profiles.length > 0 ? (
          <div className="grid gap-2 border-t border-[rgba(15,23,42,0.06)] pt-5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              可用模型档位
            </span>
            <div className="flex flex-wrap gap-2">
              {profiles.map((profile) => (
                <Chip key={profile} size="sm" variant="soft" color="success">
                  {formatModelProfile(profile)}
                </Chip>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
