import "./globals.css";
import type { Metadata } from "next";
import { App as AntdApp, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";

import { workbenchTheme } from "@/theme";
import { WorkspaceProvider } from "@/components/WorkspaceProvider";

export const metadata: Metadata = {
  title: "领航 · AI 测试工作台",
  description: "上传需求，AI 生成测试策略、测试点、测试用例与测试设计",
};

dayjs.locale("zh-cn");

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ConfigProvider locale={zhCN} theme={workbenchTheme}>
          <AntdApp>
            <WorkspaceProvider>{children}</WorkspaceProvider>
          </AntdApp>
        </ConfigProvider>
      </body>
    </html>
  );
}
