import type { ThemeConfig } from "antd";

/**
 * 领航工作台主题：青绿工作台设计语言，与 globals.css 的 CSS 变量保持一致。
 * 白卡浮起 + 品牌渐变按钮（globals.css 中实现）+ 12px 卡片圆角 + tabular 数字。
 */
export const workbenchTheme: ThemeConfig = {
  token: {
    colorPrimary: "#0D9488",
    colorInfo: "#0D9488",
    colorSuccess: "#16A34A",
    colorWarning: "#D97706",
    colorError: "#DC2626",
    borderRadius: 8,
    fontSize: 14,
    fontFamily:
      '"Segoe UI Variable Text", "Segoe UI", -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif',
    colorBgLayout: "#E3F0EC",
    colorTextHeading: "#0F172A",
    colorText: "#334155",
    colorTextSecondary: "#64748B",
    colorBorderSecondary: "#E2E8F0",
    colorLink: "#0D9488",
    boxShadowSecondary: "0 8px 24px rgba(15, 28, 46, 0.10)",
  },
  components: {
    Layout: {
      headerBg: "#ffffff",
      headerHeight: 56,
      headerPadding: "0 24px",
      siderBg: "#F7FBFA",
      bodyBg: "#E3F0EC",
      triggerBg: "#F7FBFA",
      triggerColor: "#64748B",
    },
    Card: {
      headerFontSize: 14,
    },
    Button: {
      borderRadius: 10,
      borderRadiusSM: 8,
      controlHeight: 36,
      controlHeightSM: 28,
      paddingInline: 16,
      primaryShadow: "none",
      defaultShadow: "none",
      dangerShadow: "none",
    },
    Input: {
      borderRadius: 10,
      controlHeight: 36,
    },
    Select: {
      borderRadius: 10,
      controlHeight: 36,
    },
    Table: {
      headerBg: "#F0FDFA",
      headerColor: "#334155",
      fontSize: 13,
      headerBorderRadius: 8,
      cellPaddingBlockSM: 9,
    },
    Tabs: {
      itemColor: "#64748B",
      titleFontSize: 14,
    },
    Menu: {
      itemBg: "transparent",
      itemSelectedBg: "#CCFBF1",
      itemSelectedColor: "#0F766E",
      itemBorderRadius: 10,
      itemMarginInline: 10,
    },
    Tag: {
      borderRadiusSM: 6,
    },
  },
};
