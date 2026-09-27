"use client";

import { Button, Dropdown, Empty, Space, Tooltip, Typography } from "antd";
import {
  DownloadOutlined,
  MinusOutlined,
  PlusOutlined,
  AimOutlined,
  CompressOutlined,
  NodeIndexOutlined,
} from "@ant-design/icons";
import MindElixir, { type MindElixirInstance, type NodeObj } from "mind-elixir";
// mind-elixir 4.x 样式由运行时注入，无需导入 CSS
import { useEffect, useRef, useState } from "react";

import {
  downloadBlob,
  markdownToNode,
  nodeToFreeMindXml,
  nodeToMarkdown,
  nodeToXmindBlob,
} from "./mindmapExport";

const { Text } = Typography;

/**
 * 测试设计思维导图：基于 mind-elixir 的无限画布。
 * 画布交互与 XMind 一致——空白处拖拽平移、滚轮缩放、节点可拖拽重排与双击编辑；
 * 导出基于画布当前数据（getData），用户的手动调整会被带出。
 */
export default function MindmapView({ markdown }: { markdown: string | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mindRef = useRef<MindElixirInstance | null>(null);
  const lastMarkdownRef = useRef<string | null>(null);
  const [scale, setScale] = useState(100);

  useEffect(() => {
    if (!containerRef.current || !markdown) return;
    if (lastMarkdownRef.current === markdown) return;
    lastMarkdownRef.current = markdown;

    const nodeData = markdownToNode(markdown);
    try {
      mindRef.current?.destroy();
    } catch {
      // 实例可能已随 DOM 移除
    }
    containerRef.current.innerHTML = "";

    const mind = new MindElixir({
      el: containerRef.current,
      direction: MindElixir.SIDE,
      draggable: true,
      editable: true,
      contextMenu: true,
      toolBar: false,
      keypress: true,
      overflowHidden: false,
      allowUndo: true,
      locale: "zh_CN",
      // 固定浅色主题，避免跟随系统暗色模式变成黑底
      theme: { ...MindElixir.THEME },
    });
    mind.init({ nodeData });
    mind.scaleFit();
    setScale(Math.round((mind.scaleVal ?? 1) * 100));
    mindRef.current = mind;
  }, [markdown]);

  // 卸载时销毁实例，避免 DOM 泄漏
  useEffect(() => {
    return () => {
      mindRef.current = null;
      lastMarkdownRef.current = null;
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, []);

  function applyScale(delta: number) {
    const mind = mindRef.current;
    if (!mind) return;
    const next = Math.min(2, Math.max(0.5, (mind.scaleVal ?? 1) + delta));
    mind.scale(next);
    setScale(Math.round(next * 100));
  }

  function handleScaleFit() {
    mindRef.current?.scaleFit();
    setScale(Math.round((mindRef.current?.scaleVal ?? 1) * 100));
  }

  function currentNode(): NodeObj {
    const mind = mindRef.current;
    if (!mind) throw new Error("思维导图尚未初始化");
    return mind.getData().nodeData;
  }

  async function handleExport(key: string) {
    const node = currentNode();
    if (key === "markdown") {
      downloadBlob(new Blob([nodeToMarkdown(node)], { type: "text/markdown" }), "linghang-test-design.md");
    } else if (key === "xmind") {
      downloadBlob(await nodeToXmindBlob(node), "linghang-test-design.xmind");
    } else if (key === "freemind") {
      downloadBlob(new Blob([nodeToFreeMindXml(node)], { type: "text/xml" }), "linghang-test-design.mm");
    } else if (key === "png") {
      const blob = await mindRef.current?.exportPng();
      if (blob) downloadBlob(blob, "linghang-test-design.png");
    } else if (key === "svg") {
      const blob = mindRef.current?.exportSvg();
      if (blob) downloadBlob(blob, "linghang-test-design.svg");
    }
  }

  if (!markdown) {
    return <Empty description="尚未生成测试设计。点击上方「生成」开始。" style={{ padding: "32px 0" }} />;
  }

  const exportItems = [
    { key: "xmind", label: "XMind（.xmind）" },
    { key: "freemind", label: "FreeMind / Freeplane（.mm）" },
    { key: "markdown", label: "Markdown 大纲（幕布/Typora）" },
    { type: "divider" as const },
    { key: "png", label: "图片 PNG" },
    { key: "svg", label: "矢量图 SVG" },
  ];

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <Space size={4}>
          <Tooltip title="缩小">
            <Button size="small" icon={<MinusOutlined />} onClick={() => applyScale(-0.1)} />
          </Tooltip>
          <Text type="secondary" style={{ width: 44, textAlign: "center", fontSize: 12 }}>
            {scale}%
          </Text>
          <Tooltip title="放大">
            <Button size="small" icon={<PlusOutlined />} onClick={() => applyScale(0.1)} />
          </Tooltip>
          <Tooltip title="适应画布">
            <Button size="small" icon={<CompressOutlined />} onClick={handleScaleFit} />
          </Tooltip>
          <Tooltip title="回到中心">
            <Button size="small" icon={<AimOutlined />} onClick={() => mindRef.current?.toCenter()} />
          </Tooltip>
          <Tooltip title="节点可拖拽重排、双击编辑；空白处拖拽平移、滚轮缩放">
            <Button size="small" type="text" icon={<NodeIndexOutlined />} />
          </Tooltip>
        </Space>
        <Dropdown
          menu={{ items: exportItems, onClick: ({ key }) => handleExport(String(key)) }}
          placement="bottomRight"
        >
          <Button size="small" type="primary" icon={<DownloadOutlined />}>
            导出思维导图
          </Button>
        </Dropdown>
      </div>
      <div
        ref={containerRef}
        style={{
          height: 560,
          border: "1px solid #f0f0f0",
          borderRadius: 8,
          background:
            "radial-gradient(circle, #d9d9d9 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          overflow: "hidden",
          position: "relative",
        }}
      />
    </div>
  );
}
