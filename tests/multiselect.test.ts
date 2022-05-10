import * as playwright from 'playwright'
import { describe, expect, test } from 'vitest'

const vendor = (process.env.BROWSER ?? `chromium`) as
  | 'chromium'
  | 'firefox'
  | 'webkit'

const port = process.env.PORT ?? 3000

const headful = process.env.HEADFUL
const headful_config = {
  headless: false,
  slowMo: 1000,
}

const browser = await playwright[vendor].launch(headful ? headful_config : {})
const context = await browser.newContext({
  baseURL: `http://localhost:${port}`,
})

describe(`input`, async () => {
  const page = await context.newPage()
  await page.goto(`/ui`)

  test(`opens dropdown on focus`, async () => {
    expect(await page.$(`div.multiselect > ul.options.hidden`)).toBeTruthy()
    expect(await page.$(`div.multiselect.open`)).toBeNull()

    await page.click(`input[placeholder='Pick your favorite foods!']`)

    expect(await page.$(`div.multiselect.open`)).toBeTruthy()
    await page.waitForTimeout(500) // give DOM time to update

    const visibility = await page.$eval(
      `div.multiselect > ul.options`,
      (el) => getComputedStyle(el).visibility
    )
    expect(visibility).toBe(`visible`)
  })

  test(`closes dropdown on tab out`, async () => {
    // note we only test for close on tab out, not on blur since blur should not close in case user
    // clicked anywhere else inside component
    await page.focus(`input[placeholder='Pick your favorite foods!']`)

    await page.keyboard.press(`Tab`)

    await page.waitForTimeout(500) // give DOM time to update

    const visibility = await page.$eval(
      `div.multiselect > ul.options.hidden`,
      (el) => getComputedStyle(el).visibility
    )
    expect(visibility).toBe(`hidden`)
  })

  test(`filters dropdown to show only matching options when entering text`, async () => {
    await page.fill(
      `input[placeholder='Pick your favorite foods!']`,
      `Pineapple`
    )

    await page.waitForTimeout(500) // give DOM time to update

    expect(
      await page.$$(`div.multiselect.open > ul.options > li`)
    ).toHaveLength(1)
    const text = await page.textContent(`div.multiselect.open > ul.options`)
    expect(text?.trim()).toBe(`🍍 Pineapple`)
  })
})

describe(`remove single button`, async () => {
  const page = await context.newPage()
  await page.goto(`/ui`)

  await page.click(`input#foods`)

  test(`should remove 1 option`, async () => {
    await page.click(`text=🍌 Banana`)

    await page.click(`button[title='Remove 🍌 Banana']`)

    const selected = await page.$$(
      `div.multiselect > ul.selected > li > button`
    )
    expect(selected.length).toBe(0)
  })
})

describe(`remove all button`, async () => {
  const page = await context.newPage()
  await page.goto(`/ui`)

  await page.click(`div.multiselect`) // open the dropdown
  await page.click(`div.multiselect > ul.options > li`) // select 1st option

  test(`only appears if more than 1 option is selected`, async () => {
    expect(await page.$(`button.remove-all`)).toBeNull()
    await page.click(`div.multiselect > ul.options > li`) // select next 1st option
    expect(await page.$(`button.remove-all`)).toBeTruthy()
  })

  test(`has custom title`, async () => {
    const btn = await page.$(`button.remove-all`)
    expect(await btn?.getAttribute(`title`)).toBe(`Delete all foods`)
  })

  // TODO: test button emits removeAll event
  // test(`emits removeAll event`, async () => {
  //   await page.waitForEvent(`removeAll`)
  // })

  test(`should remove all selected options`, async () => {
    await page.click(`div.multiselect > button.remove-all`)
    const selected = await page.$$(
      `div.multiselect > ul.selected > li > button`
    )
    expect(selected.length).toBe(0)
  })
})

describe(`external CSS classes`, async () => {
  const page = await context.newPage()
  await page.goto(`/css-classes`)

  await page.click(`div.multiselect`) // open the dropdown
  await page.click(`div.multiselect > ul.options > li`) // select 1st option
  await page.keyboard.press(`ArrowDown`) // make next option active

  for (const [prop, selector, cls] of [
    [`outerDivClass`, `div.multiselect`, `foo`],
    [`ulSelectedClass`, `div.multiselect > ul.selected`, `bar`],
    [`ulOptionsClass`, `div.multiselect > ul.options`, `baz`],
    [`liOptionClass`, `div.multiselect > ul.options > li`, `bam`],
    [`inputClass`, `div.multiselect > ul.selected > li > input`, `slam`],
    // below classes requires component interaction before appearing in DOM
    [`liSelectedClass`, `div.multiselect > ul.selected > li`, `hi`],
    [`liActiveOptionClass`, `div.multiselect > ul.options > li.active`, `mom`],
  ]) {
    test(`${prop} attaches to correct DOM node`, async () => {
      const node = await page.$(`${selector}.${cls}`)
      expect(node).toBeTruthy()
    })
  }
})

describe(`disabled multiselect`, async () => {
  const page = await context.newPage()
  await page.goto(`/disabled`)
  const div = await page.$(`div.multiselect.disabled`)

  test(`has attribute aria-disabled`, async () => {
    expect(await div?.getAttribute(`aria-disabled`)).to.equal(`true`)
  })

  test(`has disabled title`, async () => {
    expect(await div?.getAttribute(`title`)).to.equal(
      `Super special disabled message`
    )
  })

  test(`has input attribute disabled`, async () => {
    const input = await page.$(`.disabled > ul.selected > li > input`)
    expect(await input?.isDisabled()).to.equal(true)
  })

  test(`renders no buttons`, async () => {
    expect(await page.$$(`button`)).toHaveLength(0)
  })

  test(`renders disabled slot`, async () => {
    const span = await page.textContent(`[slot='disabled-icon']`)
    expect(await span).toBe(`This component is disabled. Get outta here!`)
  })
})

describe(`accessibility`, async () => {
  const page = await context.newPage()
  await page.goto(`/ui`)

  test(`input is aria-invalid when component has invalid=true`, async () => {
    // don't interact with component before this test as it will set invalid=false
    const invalid = await page.getAttribute(
      `input[placeholder='Pick your favorite foods!']`,
      `aria-invalid`,
      { strict: true }
    )
    expect(invalid).toBe(`true`)
  })

  test(`has aria-expanded='false' when closed`, async () => {
    const before = await page.getAttribute(`div.multiselect`, `aria-expanded`, {
      strict: true,
    })
    expect(before).toBe(`false`)
  })

  test(`has aria-expanded='true' when open`, async () => {
    await page.click(`div.multiselect`) // open the dropdown
    const after = await page.getAttribute(`div.multiselect`, `aria-expanded`, {
      strict: true,
    })
    expect(after).toBe(`true`)
  })

  test(`options have aria-selected='false' and selected items have aria-selected='true'`, async () => {
    await page.click(`div.multiselect`) // open the dropdown
    await page.click(`div.multiselect > ul.options > li`) // select 1st option
    const aria_option = await page.getAttribute(
      `div.multiselect > ul.options > li`,
      `aria-selected`
    )
    expect(aria_option).toBe(`false`)
    const aria_selected = await page.getAttribute(
      `div.multiselect > ul.selected > li`,
      `aria-selected`
    )
    expect(aria_selected).toBe(`true`)
  })

  test(`invisible input.form-control is aria-hidden`, async () => {
    // https://github.com/janosh/svelte-multiselect/issues/58

    const hidden = await page.getAttribute(
      `input.form-control`,
      `aria-hidden`,
      { strict: true }
    )
    expect(hidden).toBe(`true`)
  })
})

describe(`multiselect`, async () => {
  test(`can select and remove many options`, async () => {
    const page = await context.newPage()
    await page.goto(`/ui`)

    await page.click(`[placeholder="Pick your favorite foods!"]`)

    for (const idx of [2, 5, 8]) {
      await page.click(`ul.options >> li >> nth=${idx}`)
    }

    await page.click(`.remove-all`)

    // repeatedly select 1st option
    for (const idx of [0, 0, 0]) {
      await page.click(`ul.options >> li >> nth=${idx}`)
    }

    const selected_text = await page.textContent(
      `div.multiselect > ul.selected`
    )
    for (const food of `Grapes Melon Watermelon`.split(` `)) {
      expect(selected_text).toContain(food)
    }
  })

  test(`retains its selected state on page reload when bound to localStorage`, async () => {
    const page = await context.newPage()
    await page.goto(`/persistent`)

    await page.click(`input[name="languages"]`)

    await page.click(`text=Haskell >> nth=0`)

    await page.fill(`input[name="languages"]`, `java`)

    await page.click(`text=JavaScript`)

    await page.reload()

    await page.waitForTimeout(300)

    const selected_text = await page.textContent(
      `div.multiselect > ul.selected`
    )
    expect(selected_text).toContain(`JavaScript`)
    expect(selected_text).toContain(`Haskell`)
  })
})

describe(`allowUserOptions`, async () => {
  test(`entering custom option adds it to selected but not to options`, async () => {
    const page = await context.newPage()
    const selector = `input[name="foods"]`

    await page.goto(`/allow-user-options`)

    await page.click(selector)

    await page.fill(selector, `Durian`)

    await page.press(selector, `Enter`)

    const selected_text = await page.textContent(
      `label[for='foods'] + .multiselect > ul.selected`
    )
    expect(selected_text).toContain(`Durian`)

    const filtered_options = await page.textContent(
      `label[for='foods'] + .multiselect > ul.options`
    )
    expect(filtered_options).not.toContain(`Durian`)
  })

  test(`entering custom option in append mode adds it to selected
      list and to options in dropdown menu`, async () => {
    // i.e. it remains selectable from the dropdown after removing from selected
    const page = await context.newPage()
    const selector = `input[name="foods-append"]`

    await page.goto(`/allow-user-options`)

    await page.click(selector)

    await page.fill(selector, `Miracle Berry`)

    await page.press(selector, `Enter`)

    await page.fill(selector, `Miracle Berry`)

    await page.press(selector, `ArrowDown`)

    await page.press(selector, `Enter`)

    const selected_text = await page.textContent(
      `label[for='foods-append'] + .multiselect > ul.selected`
    )
    expect(selected_text).toContain(`Miracle Berry`)
  })

  test(`shows custom addOptionMsg if no options match`, async () => {
    const page = await context.newPage()
    const selector = `input[name="foods-append"]`

    await page.goto(`/allow-user-options`)

    await page.click(selector)

    await page.fill(selector, `Foobar Berry`)

    await page.waitForTimeout(500) // give DOM time to update

    const selected_text = await page.textContent(
      `label[for='foods-append'] + .multiselect > ul.options`
    )
    expect(selected_text).toContain(`Add this custom food at your own risk!`)
  })
})

describe(`sortSelected`, async () => {
  const labels = `Svelte Vue React Angular Polymer Laravel Django`.split(` `)

  test(`default sorting is alphabetical by label`, async () => {
    const page = await context.newPage()

    await page.goto(`/sort-selected`)

    await page.click(`input[name="default-sort"]`) // open dropdown

    for (const label of labels) {
      await page.click(`css=.multiselect.open >> text=${label}`)
    }

    const selected = await page.textContent(
      `div.multiselect.open > ul.selected`
    )
    expect(selected?.trim()).toBe(
      `Angular Django Laravel Polymer React Svelte Vue`
    )
  })

  test(`custom sorting`, async () => {
    const page = await context.newPage()

    await page.goto(`/sort-selected`)

    await page.click(`input[name="custom-sort"]`) // open dropdown

    for (const label of labels) {
      await page.click(`css=.multiselect.open >> text=${label}`)
    }

    const selected = await page.textContent(
      `div.multiselect.open > ul.selected`
    )
    expect(selected?.trim()).toBe(
      `Angular Polymer React Svelte Vue Laravel Django`
    )
  })
})
