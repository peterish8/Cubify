import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  formatResultInputValue,
  parseResultInput,
  resultInputKind,
} from "../lib/wca-result-input"

describe("wca-result-input", () => {
  it("classifies event input kinds", () => {
    assert.equal(resultInputKind("333", "single"), "time")
    assert.equal(resultInputKind("333fm", "single"), "fmc-single")
    assert.equal(resultInputKind("333fm", "average"), "fmc-average")
    assert.equal(resultInputKind("333mbf", "single"), "unsupported")
  })

  it("parses time strings to centiseconds", () => {
    assert.equal(parseResultInput("333", "single", "8.5"), 850)
    assert.equal(parseResultInput("333", "single", "8.50"), 850)
    assert.equal(parseResultInput("333", "single", "1:05.32"), 6532)
    assert.equal(parseResultInput("333", "single", "1:05"), 6500)
    assert.equal(parseResultInput("333", "single", ""), null)
    assert.equal(parseResultInput("333", "single", "nope"), null)
    assert.equal(parseResultInput("333", "single", "1:65.00"), null)
  })

  it("parses FMC", () => {
    assert.equal(parseResultInput("333fm", "single", "25"), 25)
    assert.equal(parseResultInput("333fm", "average", "25.00"), 2500)
    assert.equal(parseResultInput("333fm", "average", "25.5"), 2550)
    assert.equal(parseResultInput("333fm", "single", "25.5"), null)
  })

  it("formats values back for inputs", () => {
    assert.equal(formatResultInputValue("333", "single", 850), "8.5")
    assert.equal(formatResultInputValue("333", "single", 6532), "1:05.32")
    assert.equal(formatResultInputValue("333fm", "single", 25), "25")
    assert.equal(formatResultInputValue("333fm", "average", 2500), "25.00")
  })
})
