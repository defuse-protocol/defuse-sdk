const defaultFormatOptions: Intl.NumberFormatOptions = {
  style: "currency",
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits: 2,
}

export function FormattedCurrency({
  value,
  locale,
  formatOptions,
  className,
  mainPartClassName,
  centsClassName,
}: {
  value: number
  formatOptions: Intl.NumberFormatOptions
  locale?: string
  className?: string
  mainPartClassName?: string
  centsClassName?: string
}) {
  const formatter = new Intl.NumberFormat(locale, {
    ...defaultFormatOptions,
    ...formatOptions,
  })
  const parts = formatter.formatToParts(value)

  const currencySymbol =
    parts.find((part) => part.type === "currency")?.value || "$"
  const integerPart =
    parts.find((part) => part.type === "integer")?.value || "0"
  const decimalPart =
    parts.find((part) => part.type === "decimal")?.value || "."
  const fractionPart =
    parts.find((part) => part.type === "fraction")?.value || "00"

  return (
    <div className={className}>
      <span className={mainPartClassName}>{currencySymbol}</span>
      <span className={mainPartClassName}>{integerPart}</span>
      <span className={mainPartClassName}>{decimalPart}</span>
      <span className={centsClassName}>{fractionPart}</span>
    </div>
  )
}
