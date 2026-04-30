const MODEL_LABELS = {
  gpt: { label: "GPT", description: "gpt-5.5 coding agent" },
  deepseek: { label: "DeepSeek", description: "deepseek-v4-pro coding agent" },
};

export function buildModelOptions(profiles) {
  const values = profiles.length > 0 ? profiles : ["gpt", "deepseek"];
  return values.map((profile) => ({
    value: profile,
    label: MODEL_LABELS[profile]?.label || profile,
    description: MODEL_LABELS[profile]?.description || profile,
  }));
}

export function formatModelProfile(profile) {
  return MODEL_LABELS[profile]?.label || profile || "GPT";
}
