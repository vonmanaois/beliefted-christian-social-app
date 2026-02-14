export const MENTION_REGEX = /@([a-zA-Z0-9_.]{1,30})/g;

const isWordChar = (value: string) => /[A-Za-z0-9_]/.test(value);

export const extractMentions = (text: string) => {
  if (!text) return [];
  const matches = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = MENTION_REGEX.exec(text)) !== null) {
    const start = match.index;
    const before = start > 0 ? text[start - 1] : "";
    if (before && isWordChar(before)) {
      continue;
    }
    const username = match[1];
    if (username) {
      matches.add(username.toLowerCase());
    }
  }
  return Array.from(matches);
};

export const stripHtmlToText = (html: string) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const linkifyMentionsHtml = (html: string) => {
  if (typeof window === "undefined") return html;
  if (!html) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (node.nodeValue && node.nodeValue.includes("@")) {
      nodes.push(node);
    }
  }

  nodes.forEach((node) => {
    const text = node.nodeValue ?? "";
    const fragment = doc.createDocumentFragment();
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    MENTION_REGEX.lastIndex = 0;
    while ((match = MENTION_REGEX.exec(text)) !== null) {
      const start = match.index;
      const before = start > 0 ? text[start - 1] : "";
      if (before && isWordChar(before)) {
        continue;
      }
      const username = match[1];
      const end = start + match[0].length;
      if (start > lastIndex) {
        fragment.appendChild(doc.createTextNode(text.slice(lastIndex, start)));
      }
      const link = doc.createElement("a");
      link.href = `/profile/${username}`;
      link.textContent = `@${username}`;
      link.className = "mention-link";
      fragment.appendChild(link);
      lastIndex = end;
    }
    if (lastIndex < text.length) {
      fragment.appendChild(doc.createTextNode(text.slice(lastIndex)));
    }
    if (fragment.childNodes.length) {
      node.parentNode?.replaceChild(fragment, node);
    }
  });

  return doc.body.innerHTML;
};
