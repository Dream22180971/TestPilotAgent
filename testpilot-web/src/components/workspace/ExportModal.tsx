"use client";

import { Checkbox, Modal, Radio, Space, Typography } from "antd";
import { useState } from "react";

import { TARGET_LABELS } from "@/hooks/useWorkspace";

const { Text } = Typography;

const ALL_TARGETS = [
  "analysis",
  "test_strategy",
  "test_plan",
  "test_points",
  "test_cases",
  "test_script",
];

const FORMATS = [
  { value: "json", label: "JSON" },
  { value: "markdown", label: "Markdown" },
  { value: "xlsx", label: "Excel" },
];

export default function ExportModal({
  open,
  exporting,
  onClose,
  onExport,
}: {
  open: boolean;
  exporting: boolean;
  onClose: () => void;
  onExport: (format: string, targets: string[]) => void;
}) {
  const [format, setFormat] = useState("markdown");
  const [targets, setTargets] = useState<string[]>(["test_points", "test_cases"]);

  return (
    <Modal
      title="导出测试资产"
      open={open}
      onCancel={onClose}
      onOk={() => onExport(format, targets)}
      confirmLoading={exporting}
      okText="导出并下载"
      cancelText="取消"
    >
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <div>
          <Text strong style={{ display: "block", marginBottom: 8 }}>
            导出格式
          </Text>
          <Radio.Group
            options={FORMATS}
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            optionType="button"
            buttonStyle="solid"
          />
        </div>
        <div>
          <Text strong style={{ display: "block", marginBottom: 8 }}>
            导出模块
          </Text>
          <Checkbox.Group
            value={targets}
            onChange={(values) => setTargets(values as string[])}
            options={ALL_TARGETS.map((t) => ({ value: t, label: TARGET_LABELS[t] ?? t }))}
          />
        </div>
      </Space>
    </Modal>
  );
}
