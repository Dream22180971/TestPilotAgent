"use client";

/**
 * 把模型输出的“长字符串”还原成结构：
 * - 「名称（说明）」「名称：说明」→ 标题 + 说明
 * - 「【分组】内容；内容」「人员：…。环境：…」→ 分组 + 要点
 * - 「第1周…；第2-3周…；关键里程碑：M1…、M2…」→ 时间线 + 里程碑
 * 解析失败时退化为原文，不丢内容。
 */

const OPEN = "（(【[";
const CLOSE = "）)】]";

/** 按分隔符切分，但不切括号内部 */
export function splitOutside(text: string, separators: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if (OPEN.includes(ch)) depth++;
    else if (CLOSE.includes(ch)) depth = Math.max(0, depth - 1);
    if (depth === 0 && separators.includes(ch)) {
      if (current.trim()) parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

const trimPunct = (s: string) => s.replace(/^[\s，,、]+|[\s。；;，,]+$/g, "");

/** 从 openIndex 处的左括号开始，找到与它配对的右括号位置 */
function matchingClose(text: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    if (OPEN.includes(text[i])) depth++;
    else if (CLOSE.includes(text[i]) && --depth === 0) return i;
  }
  return -1;
}

/** 第一个不在括号内的冒号位置 */
function colonOutside(text: string): number {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (OPEN.includes(ch)) depth++;
    else if (CLOSE.includes(ch)) depth = Math.max(0, depth - 1);
    else if (depth === 0 && (ch === "：" || ch === ":")) return i;
  }
  return -1;
}

export interface TitledText {
  title?: string;
  /** 名称后的短标注，如「（新增）」 */
  note?: string;
  body: string;
}

/**
 * 「名称：说明」「名称（标注）：说明」「名称（说明）」→ 结构化；
 * 括号必须真正配对，避免把「A（新增）：…（可选）」误拆成「A · 新增）：…」。
 */
export function splitTitle(text: string): TitledText {
  const t = trimPunct(text);

  const colon = colonOutside(t);
  if (colon >= 2) {
    const head = t.slice(0, colon).trim();
    const body = t.slice(colon + 1).trim();
    const noted = head.match(/^(.+?)\s*[（(]([^（）()]{1,8})[）)]$/);
    const title = noted ? noted[1] : head;
    if (body && title.length <= 18 && !/[，,。；;]/.test(title)) {
      return { title, note: noted?.[2], body };
    }
  }

  const open = t.search(/[（(]/);
  if (open >= 2 && open <= 24 && matchingClose(t, open) === t.length - 1) {
    return { title: t.slice(0, open).trim(), body: t.slice(open + 1, -1).trim() };
  }

  return { body: t };
}

/**
 * 一组条目要么统一按「名称 + 说明」展示，要么统一按普通文本：
 * 只有绝大多数条目（≥75%）有名称时才启用，避免同一列表里零星加粗。
 */
export function parseTitledList(items: string[]): { parsed: TitledText[]; titled: boolean } {
  const parsed = items.map(splitTitle);
  const count = parsed.filter((p) => p.title).length;
  const titled = items.length > 0 && count / items.length >= 0.75;
  return { parsed: titled ? parsed : items.map((i) => ({ body: trimPunct(i) })), titled };
}

export interface Segment {
  label?: string;
  items: string[];
}

/** 长段落 → 分组要点 */
export function splitSegments(text: string): Segment[] {
  const t = (text ?? "").trim();
  if (!t) return [];
  const items = (body: string) =>
    splitOutside(body, "；;")
      .flatMap((part) => {
        // "Faker（…）、PyMySQL（…）、Git（…）" 这种“工具（说明）”并列才按顿号拆，普通并列词保持一句
        const pieces = splitOutside(part, "、");
        const described = pieces.filter((p) => /[（(].+[）)]$/.test(trimPunct(p))).length;
        return pieces.length >= 2 && described >= pieces.length - 1 ? pieces : [part];
      })
      .map(trimPunct)
      .filter(Boolean);

  if (/【[^】]+】/.test(t)) {
    const out: Segment[] = [];
    const lead = t.slice(0, t.indexOf("【")).trim();
    if (lead) out.push({ items: items(lead) });
    for (const m of t.matchAll(/【([^】]+)】([^【]*)/g)) out.push({ label: m[1].trim(), items: items(m[2]) });
    return out.filter((s) => s.items.length || s.label);
  }

  const out: Segment[] = [];
  for (const sentence of splitOutside(t, "。")) {
    const m = sentence.match(/^([^：:，,；;（(]{2,8})[：:]([\s\S]+)$/);
    if (m) out.push({ label: m[1].trim(), items: items(m[2]) });
    else out.push({ items: items(sentence) });
  }
  return out;
}

export interface Schedule {
  summary?: string;
  steps: { when?: string; what: string }[];
  milestones: { name: string; when?: string }[];
}

const WEEK_RE = /^(第[\d一二三四五六七八九十\-–~至、]+[周天日](?:末|初|中)?)[：:，,\s]*([\s\S]*)$/;

export function parseSchedule(text: string): Schedule {
  const result: Schedule = { steps: [], milestones: [] };
  for (let part of splitOutside(text ?? "", "；;。")) {
    part = trimPunct(part);
    if (!part) continue;
    const ms = part.match(/^[^：:]*里程碑[：:]([\s\S]+)$/);
    if (ms) {
      for (const item of splitOutside(ms[1], "、，,")) {
        const { title, body } = splitTitle(item);
        result.milestones.push(title ? { name: title, when: body } : { name: body });
      }
      continue;
    }
    // "整体测试周期约10周（…）：第1周完成…" → 概述 + 第一步
    const lead = part.match(/^([^第]+?)[：:](第[\s\S]+)$/);
    if (lead && !result.summary) {
      result.summary = lead[1].trim();
      part = lead[2];
    }
    const week = part.match(WEEK_RE);
    if (week) result.steps.push({ when: week[1], what: trimPunct(week[2]) });
    else if (!result.summary && result.steps.length === 0) result.summary = part;
    else result.steps.push({ what: part });
  }
  return result;
}

// ---------------------------------------------------------------------------
// 展示组件
// ---------------------------------------------------------------------------

/** 标题 + 说明 卡片网格（测试级别 / 类型等） */
export function TitledGrid({ items, tone = "teal" }: { items: string[]; tone?: "teal" | "violet" }) {
  return (
    <div className="titled-grid">
      {items.map((item, i) => {
        const { title, note, body } = splitTitle(item);
        return (
          <div key={i} className={`titled-card is-${tone}`}>
            <div className="titled-card-title">
              {title ?? body}
              {note && <span className="rich-note">{note}</span>}
            </div>
            {title && <div className="titled-card-body">{body}</div>}
          </div>
        );
      })}
    </div>
  );
}

/** 一条已解析的条目：名称加粗 +（可选）标注 + 说明 */
export function RichText({ item }: { item: TitledText }) {
  if (!item.title) return <>{item.body}</>;
  return (
    <>
      <b className="rich-title">{item.title}</b>
      {item.note && <span className="rich-note">{item.note}</span>}
      <span className="rich-sep">·</span>
      {item.body}
    </>
  );
}

/** 长段落 → 分组卡片（工具与环境、资源估算等） */
export function SegmentBlocks({ text }: { text: string }) {
  const segments = splitSegments(text);
  if (segments.length <= 1 && (segments[0]?.items.length ?? 0) <= 1) {
    return <p className="plain-text">{text}</p>;
  }
  return (
    <div className="segment-grid">
      {segments.map((seg, i) => (
        <div key={i} className="segment-card">
          {seg.label && <div className="segment-label">{seg.label}</div>}
          <ul className="segment-list">
            {parseTitledList(seg.items).parsed.map((item, j) => (
              <li key={j}>
                <RichText item={item} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** 编号清单（依赖、前置条件等） */
export function NumberedGrid({ items }: { items: string[] }) {
  return (
    <div className="numbered-grid">
      {parseTitledList(items).parsed.map((item, i) => (
        <div key={i} className="numbered-item">
          <span className="numbered-badge">{i + 1}</span>
          <div>
            <RichText item={item} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** 进度安排：时间线 + 里程碑 */
export function ScheduleView({ text }: { text: string }) {
  const schedule = parseSchedule(text);
  if (schedule.steps.length < 2 && schedule.milestones.length === 0) {
    return <p className="plain-text">{text}</p>;
  }
  return (
    <div>
      {schedule.summary && <div className="schedule-summary">{schedule.summary}</div>}
      <div className="schedule-line">
        {schedule.steps.map((step, i) => (
          <div key={i} className="schedule-step">
            <span className="schedule-when">{step.when ?? "—"}</span>
            <span className="schedule-what">{step.what}</span>
          </div>
        ))}
      </div>
      {schedule.milestones.length > 0 && (
        <div className="milestones">
          {schedule.milestones.map((m, i) => (
            <div key={i} className="milestone">
              <span className="milestone-diamond" />
              <div>
                <div className="milestone-name">{m.name}</div>
                {m.when && <div className="milestone-when">{m.when}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
