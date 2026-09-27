"use client";

import { Button, Input, Space, Spin, Tag, Timeline, Typography } from "antd";
import { CheckCircleOutlined, CloseCircleOutlined, EditOutlined, SendOutlined } from "@ant-design/icons";
import { useState } from "react";

const { Text } = Typography;

export interface FollowupRecord {
  instruction: string;
  status: "pending" | "done" | "error";
  at: number;
}

/**
 * 模块级追问面板（修订记录模式）：
 * 提交的追问立即作为一条修订记录出现（Timeline），
 * 处理中显示旋转状态，完成后标记「已生效」并更新结果；
 * 修订轮数随记录累积，作为结果版本的可追溯线索。
 */
export default function FollowupPanel({
  targetLabel,
  records,
  onSubmit,
  loading,
  disabled,
}: {
  targetLabel: string;
  records: FollowupRecord[];
  onSubmit: (instruction: string) => void;
  loading: boolean;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");

  function submit() {
    if (!text.trim() || loading) return;
    onSubmit(text.trim());
    setText("");
  }

  return (
    <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 12, marginTop: 16 }}>
      {records.length > 0 && (
        <Timeline
          style={{ marginBottom: 12 }}
          items={records.map((r) => ({
            dot:
              r.status === "pending" ? (
                <Spin size="small" />
              ) : r.status === "done" ? (
                <CheckCircleOutlined style={{ color: "#52c41a", fontSize: 15 }} />
              ) : (
                <CloseCircleOutlined style={{ color: "#ff4d4f", fontSize: 15 }} />
              ),
            children: (
              <div>
                <Space size={6} wrap>
                  <EditOutlined style={{ color: "#8c8c8c", fontSize: 12 }} />
                  <Text style={{ fontSize: 13 }}>{r.instruction}</Text>
                  {r.status === "pending" && <Tag color="processing">修订中…</Tag>}
                  {r.status === "done" && <Tag color="success">已生效</Tag>}
                  {r.status === "error" && <Tag color="error">失败</Tag>}
                </Space>
              </div>
            ),
          }))}
        />
      )}
      <Space.Compact style={{ width: "100%" }}>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPressEnter={submit}
          disabled={disabled || loading}
          placeholder={disabled ? `先生成${targetLabel}，再进行追问修订` : `对${targetLabel}提出修订意见，例如"补充弱网与并发场景"…`}
        />
        <Button type="primary" icon={<SendOutlined />} onClick={submit} loading={loading} disabled={disabled}>
          追问
        </Button>
      </Space.Compact>
    </div>
  );
}
