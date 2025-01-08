import { type InputHTMLAttributes, type ReactNode, forwardRef } from "react"
import { AssetComboIcon } from "../../../../components/Asset/AssetComboIcon"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../../../types/base"
import { isBaseToken } from "../../../../utils/token"

export function TokenAmountInputCard({
  tokenSlot,
  inputSlot,
  balanceSlot,
  priceSlot,
}: {
  tokenSlot?: ReactNode
  inputSlot?: ReactNode
  balanceSlot?: ReactNode
  priceSlot?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border bg-gray-50 p-4">
      <div className="flex items-center gap-4">
        {/* Amount Input */}
        <div className="flex-1">{inputSlot}</div>

        {/* Token Selector */}
        <div className="shrink-0">{tokenSlot}</div>
      </div>

      <div className="flex items-center justify-between">
        {/* Price */}
        <div>{priceSlot}</div>

        {/* Balance */}
        <div>{balanceSlot}</div>
      </div>
    </div>
  )
}

TokenAmountInputCard.Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input(props, ref) {
  return (
    <input
      ref={ref}
      type="text"
      inputMode="decimal"
      pattern="[0-9]*[.]?[0-9]*"
      autoComplete="off"
      placeholder="0"
      className="w-full border-0 bg-transparent p-0 font-medium text-3xl focus:ring-0"
      {...props}
    />
  )
})

TokenAmountInputCard.DisplayToken = function DisplayToken({
  token,
}: { token: BaseTokenInfo | UnifiedTokenInfo }) {
  return (
    <div className="flex items-center gap-2">
      <AssetComboIcon
        icon={token.icon}
        name={token.name}
        chainIcon={isBaseToken(token) ? token.chainIcon : undefined}
        chainName={isBaseToken(token) ? token.chainName : undefined}
      />

      <div className="font-bold text-gray-800 text-sm">{token.symbol}</div>
    </div>
  )
}

TokenAmountInputCard.DisplayPrice = function DisplayPrice({
  children,
}: {
  children: ReactNode
}) {
  return <div className="font-medium text-gray-500 text-sm">{children}</div>
}
