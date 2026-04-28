export function buildPrompt(description: string, language: "EN" | "zh" = "EN"): string {
  if (language === "zh") {
    return `生成桌面壁纸图片，关于 ${description}`;
  } else {
    return `generate desktop wallpaper image about ${description}`;
  }
}

