import type { ThemeConfig } from "antd";

/**
 * 工作台统一主题：白底卡片 + 品牌蓝 + 克制的圆角阴影，
 * 参考 Ant Design Pro 中后台范式的默认视觉。
 */
export const workbenchTheme: ThemeConfig = {
  token: {
    colorPrimary: "#1677ff",
    colorInfo: "#1677ff",
    borderRadius: 8,
    fontSize: 14,
    colorBgLayout: "#f5f7fa",
    colorTextHeading: "#1f2937",
  },
  components: {
    Layout: {
      headerBg: "#ffffff",
      headerHeight: 56,
      headerPadding: "0 24px",
      siderBg: "#ffffff",
    },
    Card: {
      headerFontSize: 15,
    },
    Steps: {
      marginXS: 4,
    },
    Table: {
      headerBg: "#fafafa",
      fontSize: 13,
    },
  },
};
