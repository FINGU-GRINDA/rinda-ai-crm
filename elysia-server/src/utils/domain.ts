/** Common multi-part TLDs — registrable-domain reduction uses last 3 labels for these. */
const MULTI_PART_TLDS = new Set([
  "co.uk",
  "co.jp",
  "co.kr",
  "co.in",
  "co.nz",
  "co.za",
  "com.au",
  "com.br",
  "com.cn",
  "com.tw",
  "com.hk",
  "com.sg",
  "com.mx",
  "ne.jp",
  "or.jp",
  "org.uk",
  "ac.uk",
  "gov.uk",
])

/** Extract the registrable domain (eTLD+1, with a few eTLD+2 cases) from a hostname, lower-cased. */
export function registrableDomain(hostname: string | null | undefined): string | null {
  if (!hostname) return null
  const h = hostname.trim().toLowerCase().replace(/\.$/, "")
  if (!h || !h.includes(".")) return null
  const labels = h.split(".").filter(Boolean)
  if (labels.length < 2) return null
  const lastTwo = labels.slice(-2).join(".")
  if (MULTI_PART_TLDS.has(lastTwo) && labels.length >= 3) {
    return labels.slice(-3).join(".")
  }
  return lastTwo
}
