import type { NodeObj } from "mind-elixir";

/**
 * 测试设计思维导图的结构转换与文件导出。
 * 中间格式统一用 mind-elixir 的 NodeObj 树，
 * Markdown / FreeMind(.mm) / XMind(.xmind) 都从它转换。
 */

let uidCounter = 0;
function uid(): string {
  uidCounter += 1;
  return `n${Date.now().toString(36)}${uidCounter}`;
}

/** 解析 Markdown 缩进列表（"- " 前缀，2 空格一级）为思维导图树 */
export function markdownToNode(markdown: string): NodeObj {
  const lines = markdown
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return null;
      const indent = line.length - line.trimStart().length;
      const topic = trimmed.replace(/^[-*+]\s+/, "").replace(/^#\s+/, "");
      return { level: Math.floor(indent / 2), topic };
    })
    .filter((item): item is { level: number; topic: string } => item !== null);

  if (lines.length === 0) {
    return { id: uid(), topic: "测试设计" };
  }

  const root: NodeObj = { id: uid(), topic: lines[0].topic };
  const stack: { node: NodeObj; level: number }[] = [{ node: root, level: lines[0].level }];

  for (const { level, topic } of lines.slice(1)) {
    const node: NodeObj = { id: uid(), topic };
    while (stack.length > 1 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].node;
    parent.children = parent.children ?? [];
    parent.children.push(node);
    stack.push({ node, level });
  }

  return root;
}

/** 树 → Markdown 缩进列表 */
export function nodeToMarkdown(node: NodeObj, level = 0): string {
  const lines = [`${"  ".repeat(level)}- ${node.topic}`];
  for (const child of node.children ?? []) {
    lines.push(nodeToMarkdown(child, level + 1));
  }
  return lines.join("\n");
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 树 → FreeMind / Freeplane 的 .mm XML */
export function nodeToFreeMindXml(node: NodeObj): string {
  function toXml(n: NodeObj): string {
    const children = (n.children ?? []).map(toXml).join("");
    return `<node TEXT="${escapeXml(n.topic)}">${children}</node>`;
  }
  return `<map version="1.0.1">${toXml(node)}</map>`;
}

interface XmindTopic {
  id: string;
  class: "topic";
  title: string;
  children?: { attached: XmindTopic[] };
}

/** 树 → XMind Zen/2021+ 的 .xmind（zip 包） */
export async function nodeToXmindBlob(node: NodeObj): Promise<Blob> {
  const { default: JSZip } = await import("jszip");

  function toXmindTopic(n: NodeObj): XmindTopic {
    return {
      id: uid(),
      class: "topic",
      title: n.topic,
      ...(n.children?.length ? { children: { attached: n.children.map(toXmindTopic) } } : {}),
    };
  }

  const content = [
    {
      id: uid(),
      class: "sheet",
      title: "测试设计",
      rootTopic: toXmindTopic(node),
      topicPositioning: "fixed",
    },
  ];
  const metadata = { creator: { name: "领航 AI 测试工作台", version: "1.0" } };
  const manifest = { "file-entries": { "content.json": {}, "metadata.json": {} } };

  const zip = new JSZip();
  zip.file("content.json", JSON.stringify(content, null, 2));
  zip.file("metadata.json", JSON.stringify(metadata, null, 2));
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

export { downloadBlob } from "@/services/api";
