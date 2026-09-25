import "./globals.css";
import type { Metadata } from "next";
import { App as AntdApp, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";

import { workbenchTheme } from "@/theme";

export const metadata: Metadata = {
  title: "领航 · AI 测试工作台",
  description: "上传需求，AI 生成测试策略、测试点、测试用例与测试设计",
};

dayjs.locale("zh-cn");

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <ConfigProvider locale={zhCN} theme={workbenchTheme}>
          <AntdApp>{children}</AntdApp>
        </ConfigProvider>
      </body>
    </html>
  );
}
