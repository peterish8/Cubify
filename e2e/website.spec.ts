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
  totalCubers: 6,
  countries: [
    { iso2: "US", name: "United States", continentId: "_North America", cubers: 3 },
    { iso2: "IN", name: "India", continentId: "_Asia", cubers: 2 },
    { iso2: "CA", name: "Canada", continentId: "_North America", cubers: 1 },
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
  personal_records: {
    "333": {
      single: { best: 900 },
      average: { best: 1100 },
    },
  },
}

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
  await page.route("https://www.worldcubeassociation.org/api/v0/persons/**", (route) =>
    route.fulfill({ json: mockPlayer }),
  )
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
    { path: "/", heading: /where you rank/i },
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

test("settings theme choice is saved and restored", async ({ page }) => {
  await page.goto("/settings", { waitUntil: "domcontentloaded" })

  const greenFolder = page.getByTestId("theme-family-folder-green")
  await expect(greenFolder).toBeVisible()
  await page.waitForTimeout(500)
  await greenFolder.click()
  await expect(page.getByTestId("theme-green-bright")).toBeVisible()
  await page.getByTestId("theme-green-bright").click()

  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.cubifyTheme)).toBe("green-bright")
  await expect.poll(() => page.evaluate(() => localStorage.getItem("cubify-theme"))).toBe("green-bright")

  await page.reload()

  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.cubifyTheme)).toBe("green-bright")
  await expect(page.locator("h2", { hasText: "Mint Pastel" })).toBeVisible()
})

test("countries page loads data, filters, and switches graph modes", async ({ page }) => {
  await page.goto("/countries", { waitUntil: "domcontentloaded" })

  await expect(page.getByText("United States").first()).toBeVisible()
  // Scope the total to the "Total cubers" stat card so a bare "6" can't match
  // unrelated text like "67%" or "6 cubers" elsewhere on the page.
  const totalCubersCard = page.locator(".surface-card", { hasText: "Total cubers" })
  await expect(totalCubersCard.getByText("6", { exact: true })).toBeVisible()
  await expect(page.getByText("3 ranked countries")).toBeVisible()

  await page.getByRole("button", { name: /Horizontal/i }).click()
  await expect(page.getByText(/The horizontal view virtualizes/i)).toBeVisible()

  await page.getByPlaceholder(/Search country/i).fill("India")
  await expect(page.getByText("1 ranked countries")).toBeVisible()
  await expect(page.getByText("India").first()).toBeVisible()
})

test("goal page loads mocked WCA data and calculates ranks", async ({ page }) => {
  await page.goto("/goal", { waitUntil: "domcontentloaded" })

  const wcaIdInput = page.getByPlaceholder("2022RPRA01")
  await wcaIdInput.fill("2022TEST01")
  await expect(wcaIdInput).toHaveValue("2022TEST01")
  const continueButton = page.getByRole("button", { name: /Continue/i })
  await expect(continueButton).toBeEnabled()
  await page.waitForTimeout(500)
  await continueButton.click()

  await expect(page.getByText("Test Cuber")).toBeVisible()
  await expect(page.getByText("Plan your next official PB")).toBeVisible()

  const resultInput = page.getByPlaceholder(/8\.50 or 1:05\.32/i)
  await expect(resultInput).toHaveValue("9")
  await expect(page.getByText(/ranked single world/i)).toBeVisible()

  await resultInput.fill("7.50")

  await expect(page.getByText("#1").first()).toBeVisible()
  await expect(page.getByText(/Top 25%/i)).toBeVisible()
})
