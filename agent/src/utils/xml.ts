const XML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

const XML_DECODE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(XML_ESCAPE_MAP).map(([char, entity]) => [entity, char]),
);

export const escapeXml = (value: string): string => (
  value.replace(/[&<>"']/g, (char) => XML_ESCAPE_MAP[char] ?? char)
);

export const decodeXmlEntities = (value: string): string => (
  value.replace(/&(amp|lt|gt|quot|apos|#\d+);/g, (match, group: string) => {
    if (!group.startsWith("#")) return XML_DECODE_MAP[match] ?? match;
    const code = Number(group.slice(1));
    return Number.isFinite(code) ? String.fromCodePoint(code) : match;
  })
);
