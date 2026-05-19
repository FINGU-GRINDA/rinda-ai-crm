/**
 * Currency helpers — single source of truth for major↔minor conversion.
 *
 * ISO 4217 "minor unit" defaults to 2 decimal places, but zero-decimal
 * currencies (JPY, KRW, etc.) and the rare 3-decimal ones (BHD, KWD,
 * TND, JOD, OMR) need explicit handling so we never lose or invent
 * precision when persisting money as a bigint.
 */

const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "ISK",
  "JPY",
  "KMF",
  "KRW",
  "PYG",
  "RWF",
  "UGX",
  "UYI",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
])

const THREE_DECIMAL_CURRENCIES = new Set(["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"])

export function currencyDecimals(currency: string): number {
  const code = currency.toUpperCase()
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 0
  if (THREE_DECIMAL_CURRENCIES.has(code)) return 3
  return 2
}

/** Convert a human-typed major-unit string (e.g. "1234.56") to minor units (123456n). */
export function parseAmountToMinor(input: string, currency: string): bigint {
  const cleaned = input.trim().replace(/[,\s]/g, "")
  if (cleaned === "") return 0n

  const negative = cleaned.startsWith("-")
  const abs = negative ? cleaned.slice(1) : cleaned

  if (!/^\d+(\.\d+)?$/.test(abs)) {
    throw new Error(`Invalid amount: "${input}"`)
  }

  const decimals = currencyDecimals(currency)
  const [whole, fraction = ""] = abs.split(".")
  if (fraction.length > decimals) {
    throw new Error(
      `Currency ${currency} supports at most ${decimals} fraction digits (got ${fraction.length})`,
    )
  }

  const padded = (fraction + "0".repeat(decimals)).slice(0, decimals)
  const minor = BigInt((whole || "0") + padded)
  return negative ? -minor : minor
}

/** Convert a bigint minor amount back to a major-unit Number (for Intl.NumberFormat). */
export function minorToMajor(minor: bigint, currency: string): number {
  const decimals = currencyDecimals(currency)
  if (decimals === 0) return Number(minor)
  const divisor = 10n ** BigInt(decimals)
  const whole = minor / divisor
  const remainder = minor % divisor
  return Number(whole) + Number(remainder) / Number(divisor)
}
