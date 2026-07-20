import { expect, test, type Page } from "@playwright/test"

const source = {
  name: "World Cube Association Results Export",
  exportDate: "2026-07-18T00:00:26Z",
  exportFormatVersion: "2.0.2",
  archiveUrl: "https://exports.worldcubeassociation.org/results/WCA_export_v2_199_20260718T000026Z.tsv.zip",
  url: "https://www.worldcubeassociation.org/export/results",
  attribution: "Based on competition results owned and maintained by the World Cube Association.",
}

function packI32Deltas(values: number[]) {
  const buffer = Buffer.alloc(values.length * 4)
  let previous = 0
  values.forEach((value, index) => {
    buffer.writeInt32LE(value - previous, index * 4)
    previous = value
  })
  return buffer.toString("base64")
}

function packU16(values: number[]) {
  const buffer = Buffer.alloc(values.length * 2)
  values.forEach((value, index) => buffer.writeUInt16LE(value, index * 2))
  return buffer.toString("base64")
}

function packU8(values: number[]) {
  return Buffer.from(Uint8Array.from(values)).toString("base64")
}

const countryTotals = {
  schemaVersion: 1,
  source,
  totalCubers: 165,
  countries: [
    { iso2: "US", name: "United States", continentId: "_North America", cubers: 30 },
    { iso2: "IN", name: "India", continentId: "_Asia", cubers: 25 },
    { iso2: "CA", name: "Canada", continentId: "_North America", cubers: 20 },
    { iso2: "BR", name: "Brazil", continentId: "_South America", cubers: 18 },
    { iso2: "GB", name: "United Kingdom", continentId: "_Europe", cubers: 16 },
    { iso2: "AU", name: "Australia", continentId: "_Oceania", cubers: 14 },
    { iso2: "PL", name: "Poland", continentId: "_Europe", cubers: 12 },
    { iso2: "JP", name: "Japan", continentId: "_Asia", cubers: 10 },
    { iso2: "DE", name: "Germany", continentId: "_Europe", cubers: 8 },
    { iso2: "FR", name: "France", continentId: "_Europe", cubers: 6 },
    { iso2: "ES", name: "Spain", continentId: "_Europe", cubers: 4 },
    { iso2: "MX", name: "Mexico", continentId: "_North America", cubers: 2 },
  ],
}

const rankTotals = {
  schemaVersion: 1,
  source,
  events: {
    "333": {
      single: {
        world: 4,
        continents: { "_North America": 2, _Asia: 2 },
        countries: { US: 2, IN: 2 },
      },
      average: {
        world: 2,
        continents: { "_North America": 1, _Asia: 1 },
        countries: { US: 1, IN: 1 },
      },
    },
    "222": {
      single: {
        world: 100,
        continents: { "_North America": 100 },
        countries: { US: 100 },
      },
      average: {
        world: 100,
        continents: { "_North America": 100 },
        countries: { US: 100 },
      },
    },
    "444": {
      single: {
        world: 100,
        continents: { "_North America": 100 },
        countries: { US: 100 },
      },
      average: {
        world: 100,
        continents: { "_North America": 100 },
        countries: { US: 100 },
      },
    },
    pyram: {
      single: {
        world: 100,
        continents: { "_North America": 100 },
        countries: { US: 100 },
      },
      average: {
        world: 100,
        continents: { "_North America": 100 },
        countries: { US: 100 },
      },
    },
  },
}

const rankList333Single = {
  schemaVersion: 1,
  eventId: "333",
  rankType: "single",
  encoding: "delta-i32+u16+u8-b64",
  source,
  count: 4,
  countries: ["US", "IN"],
  continents: ["_North America", "_Asia"],
  bestsB64: packI32Deltas([800, 850, 900, 1000]),
  countryIdxB64: packU16([1, 0, 0, 1]),
  continentIdxB64: packU8([1, 0, 0, 1]),
}

const mockPlayer = {
  person: {
    name: "Test Cuber",
    wca_id: "2022TEST01",
    country: {
      name: "United States",
      iso2: "US",
      continent_id: "_North America",
    },
  },
  competition_count: 2,
  total_solves: 14,
  personal_records: {
    "333": {
      single: { best: 900, world_rank: 4, continent_rank: 2, country_rank: 2 },
      average: { best: 1100, world_rank: 1, continent_rank: 1, country_rank: 1 },
    },
    "222": {
      single: { best: 180, world_rank: 10, continent_rank: 4, country_rank: 3 },
      average: { best: 230, world_rank: 8, continent_rank: 3, country_rank: 2 },
    },
    "444": {
      single: { best: 3600, world_rank: 20, continent_rank: 8, country_rank: 5 },
      average: { best: 4300, world_rank: 22, continent_rank: 9, country_rank: 6 },
    },
    pyram: {
      single: { best: 420, world_rank: 50, continent_rank: 20, country_rank: 10 },
      average: { best: 610, world_rank: 45, continent_rank: 18, country_rank: 9 },
    },
  },
}

const mockResults = [
  {
    event_id: "333",
    competition_id: "CompA2026",
    attempts: [900, 910, 920, 930, 940],
  },
  {
    event_id: "333",
    competition_id: "CompB2026",
    attempts: [880, 870, -1, -2, 0],
  },
  {
    event_id: "222",
    competition_id: "CompA2026",
    attempts: [180, 190, 185, 0, 0],
  },
  {
    event_id: "pyram",
    competition_id: "CompC2026",
    attempts: [420, 430, 440, 0, 0],
  },
]

async function installApiMocks(page: Page) {
  await page.route("https://raw.githubusercontent.com/peterish8/Cubify/rank-data/data/country-totals.json", (route) =>
    route.fulfill({ json: countryTotals }),
  )
  await page.route("https://raw.githubusercontent.com/peterish8/Cubify/rank-data/data/rank-totals.json", (route) =>
    route.fulfill({ json: rankTotals }),
  )
  await page.route("https://raw.githubusercontent.com/peterish8/Cubify/rank-data/data/rank-lists/**", (route) =>
    route.fulfill({ status: 404, body: "not mocked" }),
  )
  await page.route("https://raw.githubusercontent.com/peterish8/Cubify/rank-data/data/rank-lists/333/single.json", (route) =>
    route.fulfill({ json: rankList333Single }),
  )
  await page.route("https://www.worldcubeassociation.org/api/v0/persons/**", (route) => {
    if (route.request().url().endsWith("/results")) {
      return route.fulfill({ json: mockResults })
    }
    return route.fulfill({ json: mockPlayer })
  })
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text())
  })
  await installApiMocks(page)
  ;(page as Page & { __errors?: string[] }).__errors = errors
})

test.afterEach(async ({ page }) => {
  const errors = (page as Page & { __errors?: string[] }).__errors ?? []
  const ignored = errors.filter(
    (message) =>
      !message.includes("Failed to load resource") &&
      !message.includes("favicon.ico") &&
      !message.includes("net::ERR_ABORTED"),
  )
  expect(ignored).toEqual([])
})

test.describe("core pages", () => {
  const pages = [
    { path: "/", heading: /finally has\s*meaning/i },
    { path: "/goal", heading: /Know the result/i },
    { path: "/compare", heading: /Face to face/i },
    { path: "/countries", heading: /Cubers by country/i },
    { path: "/settings", heading: /Settings/i },
  ]

  for (const item of pages) {
    test(`${item.path} renders meaningful content`, async ({ page }) => {
      await page.goto(item.path, { waitUntil: "domcontentloaded" })
      await expect(page.locator("body")).toContainText(item.heading)
      await expect(page.locator("body")).not.toContainText("Unhandled Runtime Error")
      await expect(page.locator("body")).not.toContainText("Application error")
      await expect(page.getByRole("link", { name: /Cubify home/i })).toBeVisible()
    })
  }
})

test("lookup about modal explains Cubify sections", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" })

  await page.getByLabel("About Cubify").click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByText(/turns WCA numbers into meaning/i)).toBeVisible()
  await expect(dialog).toContainText("Lookup")
  await expect(dialog).toContainText("Goal")
  await expect(dialog).toContainText("Compare")
  await expect(dialog).toContainText("Countries")

  await dialog.getByRole("button", { name: /Lookup/i }).click()
  await expect(dialog.getByText(/Your rank becomes a clear Top %/i)).toBeVisible()
  await expect(dialog.getByText(/#14,878 -> Top 5\.3%/i)).toBeVisible()
  await dialog.getByRole("button", { name: /Back/i }).click()
  await expect(dialog.getByText(/turns WCA numbers into meaning/i)).toBeVisible()

  await page.mouse.click(5, 5)
  await expect(dialog).toBeHidden()
})

test("landing and lookup smoke cover recent product polish", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto("/", { waitUntil: "networkidle" })

  const main = page.locator("main")
  const header = page.locator("header").first()
  await expect.poll(() => main.evaluate((node) => node.getBoundingClientRect().width)).toBeGreaterThan(1200)
  await expect.poll(async () => {
    const [mainBox, headerBox] = await Promise.all([
      main.evaluate((node) => node.getBoundingClientRect()),
      header.evaluate((node) => node.getBoundingClientRect()),
    ])
    return Math.abs(mainBox.left - headerBox.left) <= 8
  }).toBeTruthy()

  const meaning = page.locator(".meaning-spark")
  await expect(meaning).toHaveText(/meaning/i)
  await expect(meaning).toBeVisible()

  const cta = page.getByRole("button", { name: /Reveal Top %/ })
  await expect(cta.locator(".btn-cube-idle")).toBeVisible()
  await cta.click()
  await expect(page.getByText("Please enter a WCA ID")).toBeVisible()

  await page.getByPlaceholder("2022RPRA01").fill("2022TEST01")
  await cta.click()

  await expect(page.getByText("Test Cuber")).toBeVisible()
  await expect(page.getByText("Event board")).toBeVisible()
  await expect(page.getByText(/Face by face/i)).toBeVisible()
  await expect(page.getByText("Most competed event")).toBeVisible()
  await expect(page.getByText("3×3 Cube").first()).toBeVisible()
  await expect(page.getByText(/8\s*solves/i)).toBeVisible()
  await expect(page.getByText(/across\s*2\s*competitions/i)).toBeVisible()
  await expect(page.getByRole("link", { name: /WCA profile/i })).toHaveAttribute(
    "href",
    /worldcubeassociation\.org\/persons\/2022TEST01/,
  )

  const profileCard = page.locator(".bezel-inner", { hasText: "Test Cuber" }).first()
  await expect(profileCard.locator('img[src*="flagcdn.com/20x15/us.png"]')).toBeVisible()
  await expect
    .poll(() =>
      profileCard.getByText("Competitor").evaluate((node) => getComputedStyle(node).color),
    )
    .toBe("rgb(178, 34, 52)")

  await expect(page.getByText("Top 1").first()).toBeVisible()
  await expect(page.getByText("Top 2").first()).toBeVisible()
  await expect(page.getByText("Top 3").first()).toBeVisible()
  await expect(page.getByText("Featured")).toHaveCount(0)
  await expect(page.locator(".facelet-lg").first()).toBeVisible()
  await expect(page.locator(".percentile-ring").first()).toBeVisible()

  await page.getByRole("button", { name: /What is NR/i }).hover()
  const rankDialog = page.getByRole("dialog", { name: /What NR, CR, and WR mean/i })
  await expect(rankDialog).toContainText("National Rank")
  await expect(rankDialog).toContainText("United States")
  await expect(rankDialog).toContainText("North America")

  const gradientIds = await page.locator(".percentile-ring linearGradient").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("id")),
  )
  expect(new Set(gradientIds).size).toBe(gradientIds.length)
})

test("favicon uses cube rank colors", async ({ page }) => {
  const response = await page.goto("/favicon.svg")
  expect(response?.ok()).toBeTruthy()
  const svg = await response?.text()
  expect(svg).toContain("#E8E8EC")
  expect(svg).toContain("#3DFFA8")
  expect(svg).toContain("#FFC14A")
})

test("settings theme choice is saved and restored", async ({ page }) => {
  await page.goto("/settings", { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(500)

  const greenFolder = page.getByTestId("theme-family-folder-green")
  await expect(greenFolder).toBeVisible()
  await greenFolder.dispatchEvent("pointerup")
  await expect(page.getByTestId("theme-green-bright")).toBeVisible()
  await page.getByTestId("theme-green-bright").click()

  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.cubifyTheme)).toBe("green-bright")
  await expect.poll(() => page.evaluate(() => localStorage.getItem("cubify-theme"))).toBe("green-bright")

  await page.reload()

  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.cubifyTheme)).toBe("green-bright")
  await expect(page.locator("h2", { hasText: "Mint Pastel" })).toBeVisible()
})

test("settings exposes gold and Tokyo theme ladder", async ({ page }) => {
  await page.goto("/settings", { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(500)

  const goldFolder = page.getByTestId("theme-family-folder-gold")
  await expect(goldFolder).toBeVisible()
  await goldFolder.click()
  for (const id of ["gold-bright", "gold", "gold-dark"]) {
    await expect(page.getByTestId(`theme-${id}`)).toBeVisible()
  }
  await page.getByTestId("theme-gold-dark").click()
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.cubifyTheme)).toBe("gold-dark")
  await expect.poll(() => page.evaluate(() => localStorage.getItem("cubify-theme"))).toBe("gold-dark")

  const nightFolder = page.getByTestId("theme-family-folder-night")
  await nightFolder.scrollIntoViewIfNeeded()
  await nightFolder.click()
  await page.getByTestId("theme-tokyo-bright").click()
  const tokyoBrightBg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--background"))
  await page.getByTestId("theme-tokyo-night").click()
  const tokyoNightBg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--background"))
  await page.getByTestId("theme-tokyo-deeper").click()
  const tokyoDeeperBg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--background"))

  expect(tokyoBrightBg.trim()).toBe("#12131c")
  expect(tokyoNightBg.trim()).toBe("#08090f")
  expect(tokyoDeeperBg.trim()).toBe("#000000")
})

test("countries page loads data, filters, and switches graph modes", async ({ page }) => {
  await page.goto("/countries", { waitUntil: "domcontentloaded" })

  await expect(page.getByText("United States").first()).toBeVisible()
  // Scope the total to the "Total cubers" stat card so a bare "6" can't match
  // unrelated text like "67%" or "6 cubers" elsewhere on the page.
  const totalCubersCard = page.locator(".surface-card", { hasText: "Total cubers" })
  await expect(totalCubersCard.getByText("165", { exact: true })).toBeVisible()
  await expect(page.getByText("12 ranked countries")).toBeVisible()

  const barScroller = page.getByTestId("country-bar-scroller")
  await barScroller.hover()
  await page.mouse.wheel(900, 0)
  await expect.poll(() => barScroller.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0)

  await page.getByRole("button", { name: /Horizontal/i }).click()
  await expect(page.getByText(/The horizontal view virtualizes/i)).toBeVisible()

  const listScroller = page.getByTestId("country-list-scroller")
  await listScroller.hover()
  await page.mouse.wheel(0, 900)
  await expect.poll(() => listScroller.evaluate((node) => node.scrollTop)).toBeGreaterThan(0)

  await page.getByPlaceholder(/Search country/i).fill("India")
  await expect(page.getByText("1 ranked countries")).toBeVisible()
  await expect(page.getByText("India").first()).toBeVisible()
})

test("goal page loads mocked WCA data and calculates ranks", async ({ page }) => {
  await page.goto("/goal?wca=2022TEST01", { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(500)

  await expect(page.getByText("Test Cuber")).toBeVisible()
  await expect(page.getByText("Plan your next official PB")).toBeVisible()

  const resultInput = page.getByPlaceholder(/8\.50 or 1:05\.32/i)
  await expect(resultInput).toHaveValue("9")
  await expect(page.getByText(/ranked single world/i)).toBeVisible()

  await resultInput.fill("9.21")
  await expect(page.getByText("Using 9.21s")).toBeVisible()

  const wrCard = page.locator(".surface-card", { hasText: "World" }).filter({ hasText: "Desired Top %" })
  await expect(wrCard.getByText("#4").first()).toBeVisible()
  await expect(wrCard.getByText("Top 100%")).toBeVisible()
  await expect(wrCard.getByRole("textbox")).toHaveCount(2)
  await expect(wrCard.getByLabel("Desired Rank")).toHaveValue("3")
  await expect(wrCard.getByLabel("Desired Top %")).toHaveValue("75")

  await wrCard.getByLabel("Desired Top %").fill("25")

  await expect(page.getByText("World target")).toBeVisible()
  await expect(page.getByText("Required official result")).toBeVisible()
  await expect(wrCard.getByLabel("Desired Rank")).toHaveValue("1")
  await expect(page.getByText("8.00s").first()).toBeVisible()
  await expect(page.getByText("1.00s faster needed")).toBeVisible()
  await expect(page.getByText("Target rank: #1 WR")).toBeVisible()
  await expect(resultInput).toHaveValue("8")
  await expect(wrCard.getByText("#4").first()).toBeVisible()
  await expect(wrCard.getByText("Top 100%")).toBeVisible()

  await wrCard.getByLabel("Desired Rank").fill("2")

  await expect(wrCard.getByLabel("Desired Top %")).toHaveValue("50")
  await expect(page.getByText("8.50s").first()).toBeVisible()
  await expect(page.getByText("0.50s faster needed")).toBeVisible()
  await expect(page.getByText("Target rank: #2 WR")).toBeVisible()
  await expect(resultInput).toHaveValue("8.5")
  await expect(wrCard.getByText("#4").first()).toBeVisible()
  await expect(wrCard.getByText("Top 100%")).toBeVisible()
})
