"use client";

import { Button, Input, Space } from "antd";
import { SendOutlined } from "@ant-design/icons";
import { useState } from "react";

/**
 * 模块级追问框：输入内容保存在组件内部状态，
 * 提交时把文本回传给工作台，各模块之间互不串扰。
 */
export default function FollowupBox({
  targetLabel,
  onSubmit,
  loading,
  disabled,
}: {
  targetLabel: string;
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
      <Space.Compact style={{ width: "100%" }}>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPressEnter={submit}
          disabled={disabled || loading}
          placeholder={`对${targetLabel}提出修改意见，例如“补充弱网场景”…`}
        />
        <Button
          type="primary"
          ghost
          icon={<SendOutlined />}
          onClick={submit}
          loading={loading}
          disabled={disabled}
        >
          追问
        </Button>
      </Space.Compact>
    </div>
  );
}
