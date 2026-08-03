const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");

const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const out = path.join(__dirname, "..", "docs", "ui", "baselines");
fs.mkdirSync(out, { recursive: true });

const cookieFile = process.env.MEGICK_COOKIE_FILE || path.join(process.env.TEMP || "/tmp", "megick-cookies.txt");
const cookieLine = fs
  .readFileSync(cookieFile, "utf8")
  .split(/\r?\n/)
  .find((line) => line.includes("\tmg_session\t") || line.includes(" mg_session "));

if (!cookieLine) {
  console.error("mg_session cookie not found in", cookieFile);
  process.exit(1);
}

const parts = cookieLine.split("\t");
const sessionValue = parts[parts.length - 1].trim();

const routes = [
  ["impl-inspiration.png", "http://localhost:8080/dashboard/inspiration"],
  ["impl-image.png", "http://localhost:8080/dashboard/studio/image"],
  ["impl-video.png", "http://localhost:8080/dashboard/studio/video"],
  ["impl-edit.png", "http://localhost:8080/dashboard/video-editor"],
];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: "new",
    defaultViewport: { width: 1920, height: 1080 },
    args: ["--hide-scrollbars", "--disable-gpu", "--no-first-run"],
  });
  const page = await browser.newPage();
  await page.setCookie({
    name: "mg_session",
    value: sessionValue,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
  });
  await page.goto("http://localhost:8080/dashboard/inspiration", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.evaluate(() => {
    try {
      // Dismiss product onboarding overlays for shell screenshots.
      for (const key of Object.keys(localStorage)) {
        if (/onboard|tour|guide|megickcut/i.test(key)) localStorage.setItem(key, "1");
      }
      localStorage.setItem("megick-onboarding-completed", "true");
      localStorage.setItem("megickcut-onboarding-completed", "true");
    } catch {}
  });

  for (const [file, url] of routes) {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 90000 }).catch(async () => {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    });
    await page
      .waitForFunction(
        () => {
          const text = document.body?.innerText || "";
          return (
            text.includes("灵感池") ||
            text.includes("Inspiration") ||
            text.includes("MagiCore") ||
            text.includes("图像生成") ||
            text.includes("视频生成") ||
            text.includes("视频剪辑") ||
            text.includes("Image Generation") ||
            text.includes("Video Editing")
          );
        },
        { timeout: 45000 },
      )
      .catch(() => {});
    await new Promise((r) => setTimeout(r, 3000));
    const dest = path.join(out, file);
    await page.screenshot({ path: dest, fullPage: false });
    const snip = await page.evaluate(() =>
      (document.body?.innerText || "").slice(0, 280).replace(/\s+/g, " "),
    );
    console.log("saved", file, snip);
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
