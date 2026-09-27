import type { ThemeConfig } from "antd";

/**
 * 领航工作台主题：雾面蓝工作台设计语言。
 * 白卡浮起 + 品牌蓝渐变（globals.css 中实现）+ 12px 卡片圆角 + tabular 数字。
 */
export const workbenchTheme: ThemeConfig = {
  token: {
    colorPrimary: "#0D9488",
    colorInfo: "#0D9488",
    borderRadius: 8,
    fontSize: 14,
    colorBgLayout: "#E3F0EC",
    colorTextHeading: "#0F172A",
    colorText: "#334155",
    colorLink: "#0D9488",
    boxShadowSecondary: "0 8px 24px rgba(15, 28, 46, 0.10)",
  },
  components: {
    Layout: {
      headerBg: "#ffffff",
      headerHeight: 56,
      headerPadding: "0 24px",
      siderBg: "#F0FAF7",
      bodyBg: "#E3F0EC",
    },
    Card: {
      headerFontSize: 15,
    },
    Steps: {
      marginXS: 4,
    },
    Table: {
      headerBg: "#F0FDFA",
      fontSize: 13,
      headerBorderRadius: 8,
    },
    Menu: {
      itemSelectedBg: "#CCFBF1",
      itemSelectedColor: "#0D9488",
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
