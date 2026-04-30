export function buildPrompt(description: string, language: "EN" | "zh" = "EN"): string {
  if (language === "zh") {
    return `生成一张精美的超高清桌面壁纸，主题为：${description}。要求：电影级构图，戏剧性光影效果，色彩丰富鲜艳，细节精致，4K超高清画质，宽幅横向构图，专业数字艺术或摄影风格。`;
  } else {
    return `A breathtaking ultra-high-resolution desktop wallpaper featuring ${description}. Cinematic composition, dramatic lighting, rich vivid colors, highly detailed, 4K quality, wide-format landscape orientation, professional digital art or photography style.`;
  }
}

