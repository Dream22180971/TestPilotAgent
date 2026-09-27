"use client";

import { Checkbox, Modal, Radio, Space, Typography } from "antd";
import { FileExcelOutlined, FileMarkdownOutlined, FileTextOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";

import { STEP_ORDER, TARGET_LABELS } from "@/hooks/useWorkspace";

const { Text } = Typography;

const FORMATS = [
  { value: "xlsx", label: "Excel", icon: <FileExcelOutlined />, hint: "用例 / 测试点逐行成表，适合导入用例管理平台" },
  { value: "markdown", label: "Markdown", icon: <FileMarkdownOutlined />, hint: "适合评审、贴进文档或 Wiki" },
  { value: "json", label: "JSON", icon: <FileTextOutlined />, hint: "原始结构化数据，便于二次开发" },
];

export default function ExportModal({
  open,
  exporting,
  available,
  onClose,
  onExport,
}: {
  open: boolean;
  exporting: boolean;
  /** 已生成、可导出的模块 */
  available: string[];
  onClose: () => void;
  onExport: (format: string, targets: string[]) => void;
}) {
  const [format, setFormat] = useState("xlsx");
  const [targets, setTargets] = useState<string[]>([]);

  // 每次打开默认勾选全部已生成模块
  useEffect(() => {
    if (open) setTargets(available);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const current = FORMATS.find((f) => f.value === format);

  return (
    <Modal
      title="导出测试资产"
      open={open}
      onCancel={onClose}
      onOk={() => onExport(format, targets)}
      okButtonProps={{ disabled: targets.length === 0 }}
      confirmLoading={exporting}
      okText={targets.length ? `导出 ${targets.length} 个模块` : "导出"}
      cancelText="取消"
    >
      <Space direction="vertical" size={18} style={{ width: "100%", marginTop: 8 }}>
        <div>
          <Text strong style={{ display: "block", marginBottom: 8 }}>
            导出格式
          </Text>
          <Radio.Group value={format} onChange={(e) => setFormat(e.target.value)} optionType="button" buttonStyle="solid">
            {FORMATS.map((f) => (
              <Radio.Button key={f.value} value={f.value}>
                <Space size={6}>
                  {f.icon}
                  {f.label}
                </Space>
              </Radio.Button>
            ))}
          </Radio.Group>
          <Text type="secondary" style={{ display: "block", fontSize: 12, marginTop: 6 }}>
            {current?.hint}
          </Text>
        </div>
        <div>
          <Text strong style={{ display: "block", marginBottom: 8 }}>
            导出模块
          </Text>
          {available.length === 0 ? (
            <Text type="secondary">还没有已生成的模块，先在工作台生成内容。</Text>
          ) : (
            <Checkbox.Group
              value={targets}
              onChange={(values) => setTargets(values as string[])}
              options={STEP_ORDER.map((t) => ({
                value: t,
                label: TARGET_LABELS[t],
                disabled: !available.includes(t),
              }))}
            />
          )}
        </div>
      </Space>
    </Modal>
  );
}
