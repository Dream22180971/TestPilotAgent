import type { ThemeConfig } from "antd";

/**
 * 领航工作台主题：雾面蓝工作台设计语言。
 * 白卡浮起 + 品牌蓝渐变（globals.css 中实现）+ 12px 卡片圆角 + tabular 数字。
 */
export const workbenchTheme: ThemeConfig = {
  token: {
    colorPrimary: "#1668dc",
    colorInfo: "#1668dc",
    borderRadius: 8,
    fontSize: 14,
    colorBgLayout: "#eef3fa",
    colorTextHeading: "#0f1c2e",
    colorText: "#334155",
    colorLink: "#1668dc",
    boxShadowSecondary: "0 8px 24px rgba(15, 28, 46, 0.10)",
  },
  components: {
    Layout: {
      headerBg: "#ffffff",
      headerHeight: 56,
      headerPadding: "0 24px",
      siderBg: "#fbfdff",
      bodyBg: "#eef3fa",
    },
    Card: {
      headerFontSize: 15,
    },
    Steps: {
      marginXS: 4,
    },
    Table: {
      headerBg: "#f7faff",
      fontSize: 13,
      headerBorderRadius: 8,
    },
    Menu: {
      itemSelectedBg: "#e6f0ff",
      itemSelectedColor: "#1668dc",
      itemBorderRadius: 10,
      itemMarginInline: 10,
    },
    Statistic: {
      titleFontSize: 12,
      contentFontSize: 22,
    },
    Tag: {
      borderRadiusSM: 6,
    },
  },
};
