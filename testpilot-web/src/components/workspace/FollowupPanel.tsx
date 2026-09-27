"use client";

import { Button, Input, Popconfirm, Space, Tag, Typography } from "antd";
import {
  CheckOutlined,
  CloseOutlined,
  HistoryOutlined,
  LoadingOutlined,
  RobotOutlined,
  SendOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useState } from "react";

import type { FollowupRecord } from "@/hooks/useWorkspace";

const { Text } = Typography;

const STATUS_META: Record<FollowupRecord["status"], { label: string; color: string }> = {
  thinking: { label: "思考中", color: "processing" },
  answered: { label: "仅回答", color: "default" },
  proposed: { label: "待确认", color: "warning" },
  applied: { label: "已应用", color: "success" },
  discarded: { label: "已放弃", color: "default" },
  error: { label: "失败", color: "error" },
};

const QUICK_ASKS = ["还有哪些遗漏的场景？", "补充异常与边界场景", "合并重复内容，精简表述"];

function formatTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
  return date.toLocaleString("zh-CN", { hour12: false, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/**
 * 模块级追问面板（修订记录）：
 * 每轮追问先由 AI 回答或给出修订方案（不直接改内容）；
 * 有方案时用户确认「应用」才写入模块，「放弃」则保留原内容。所有轮次持久保存。
 */
export default function FollowupPanel({
  targetLabel,
  records,
  loading,
  disabled,
  isApplying,
  onSubmit,
  onApply,
  onDiscard,
}: {
  targetLabel: string;
  records: FollowupRecord[];
  loading: boolean;
  disabled?: boolean;
  isApplying: (id: string) => boolean;
  onSubmit: (instruction: string) => Promise<boolean> | void;
  onApply: (record: FollowupRecord) => void;
  onDiscard: (record: FollowupRecord) => void;
}) {
  const [text, setText] = useState("");
  const appliedCount = records.filter((r) => r.status === "applied").length;
  const pending = records.some((r) => r.status === "proposed");

  function submit(value = text) {
    const instruction = value.trim();
    if (!instruction || loading || disabled) return;
    setText("");
    onSubmit(instruction);
  }

  return (
    <div className="followup-panel">
      <div className="followup-head">
        <Space size={8}>
          <span className="icon-tile icon-tile-sm">
            <HistoryOutlined />
          </span>
          <Text strong>追问与修订记录</Text>
          {records.length > 0 && <span className="count-badge">{records.length}</span>}
        </Space>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {appliedCount > 0 ? `已应用 ${appliedCount} 轮修订 · ` : ""}AI 先给方案，确认后才修改内容
        </Text>
      </div>

      {records.length === 0 ? (
        <div className="followup-empty">
          还没有追问。可以直接提修改要求，也可以先问问 AI 的建议。
        </div>
      ) : (
        <div className="followup-list">
          {records.map((r, index) => {
            const meta = STATUS_META[r.status];
            const reasoningTail = (r.reasoning ?? "").slice(-360);
            return (
              <div key={r.id} className={`followup-round is-${r.status}`}>
                <div className="followup-round-head">
                  <Text type="secondary" className="tabular" style={{ fontSize: 12 }}>
                    第 {index + 1} 轮 · {formatTime(r.created_at)}
                  </Text>
                  <Tag color={meta.color} bordered={false} style={{ marginInlineEnd: 0 }}>
                    {r.status === "thinking" && <LoadingOutlined style={{ marginRight: 4 }} />}
                    {meta.label}
                  </Tag>
                </div>

                <div className="followup-msg">
                  <span className="followup-avatar is-user">
                    <UserOutlined />
                  </span>
                  <div className="followup-bubble is-user">{r.instruction}</div>
                </div>

                <div className="followup-msg">
                  <span className="followup-avatar is-ai">
                    <RobotOutlined />
                  </span>
                  <div className="followup-bubble is-ai">
                    {r.status === "thinking" ? (
                      <>
                        <Text type="secondary" style={{ fontSize: 13 }}>
                          AI 正在思考{targetLabel}的修订方案…
                        </Text>
                        {reasoningTail && <div className="followup-reasoning">{reasoningTail}</div>}
                      </>
                    ) : r.status === "error" ? (
                      <Text type="danger" style={{ fontSize: 13 }}>{r.detail || "AI 回复失败"}</Text>
                    ) : (
                      <>
                        <div style={{ whiteSpace: "pre-wrap" }}>{r.reply || "（无文字回复）"}</div>
                        {r.changes.length > 0 && (
                          <div className="followup-changes">
                            <Text strong style={{ fontSize: 12, color: "var(--ink-2)" }}>
                              改动点
                            </Text>
                            {r.changes.map((c, i) => (
                              <div key={i} className="followup-change">
                                {c}
                              </div>
                            ))}
                          </div>
                        )}
                        {r.status === "proposed" && (
                          <Space size={8} style={{ marginTop: 12 }}>
                            <Button
                              type="primary"
                              size="small"
                              icon={<CheckOutlined />}
                              loading={isApplying(r.id)}
                              onClick={() => onApply(r)}
                            >
                              应用修订
                            </Button>
                            <Popconfirm title="放弃这次修订？" description="模块内容保持不变。" okText="放弃" cancelText="取消" onConfirm={() => onDiscard(r)}>
                              <Button size="small" icon={<CloseOutlined />}>
                                放弃
                              </Button>
                            </Popconfirm>
                          </Space>
                        )}
                        {r.status === "answered" && (
                          <div style={{ marginTop: 10 }}>
                            <Button size="small" type="link" style={{ padding: 0 }} disabled={loading || disabled} onClick={() => submit("按你上面的建议修改")}>
                              按这些建议修改 →
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!disabled && records.length === 0 && (
        <Space size={6} wrap style={{ marginBottom: 8 }}>
          {QUICK_ASKS.map((q) => (
            <button key={q} type="button" className="quick-ask" onClick={() => submit(q)} disabled={loading}>
              {q}
            </button>
          ))}
        </Space>
      )}

      <div className="followup-input">
        <Input.TextArea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          autoSize={{ minRows: 1, maxRows: 5 }}
          disabled={disabled || loading}
          variant="borderless"
          placeholder={
            disabled
              ? `先生成${targetLabel}，再进行追问`
              : pending
                ? "有待确认的修订，建议先应用或放弃；也可以继续追问…"
                : `问问 AI，或提出修改要求，例如"补充弱网与并发场景"（Enter 发送，Shift+Enter 换行）`
          }
        />
        <Button type="primary" icon={<SendOutlined />} onClick={() => submit()} loading={loading} disabled={disabled || !text.trim()}>
          追问
        </Button>
      </div>
    </div>
  );
}
