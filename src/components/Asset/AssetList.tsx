import { CheckCircle } from "@phosphor-icons/react"
import { Text } from "@radix-ui/themes"
import clsx from "clsx"
import type { ReactNode } from "react"

import type {
  BaseTokenInfo,
  TokenValue,
  UnifiedTokenInfo,
} from "../../types/base"
import type { SelectItemToken } from "../Modal/ModalSelectAssets"

import { formatTokenValue } from "../../utils/format"
import { isBaseToken } from "../../utils/token"
import { AssetComboIcon } from "./AssetComboIcon"

type Props<T> = {
  assets: SelectItemToken<T>[]
  emptyState?: ReactNode
  className?: string
  accountId?: string
  handleSelectToken?: (token: SelectItemToken<T>) => void
}

type Token = BaseTokenInfo | UnifiedTokenInfo

export const AssetList = <T extends Token>({
  assets,
  className,
  handleSelectToken,
}: Props<T>) => {
  return (
    <div className={clsx("flex flex-col", className && className)}>
      {assets.map(({ itemId, token, selected, balance }, i) => (
        <button
          key={itemId}
          type="button"
          className={clsx(
            "flex justify-between items-center gap-3 p-2.5 rounded-md hover:bg-gray-3",
            { "bg-gray-3": selected }
          )}
          // biome-ignore lint/style/noNonNullAssertion: i is always within bounds
          onClick={() => handleSelectToken?.(assets[i]!)}
        >
          <div className="relative">
            <AssetComboIcon
              icon={token.icon}
              name={token.name}
              chainName={isBaseToken(token) ? token.chainName : undefined}
              style={
                selected
                  ? {
                      mask: "radial-gradient(7px at 28px 86%, transparent 100%, rgb(255, 255, 255) 100%)",
                    }
                  : undefined
              }
            />
            {selected && (
              <div className="absolute bottom-1 -right-1.5 rounded-full">
                <CheckCircle width={12} height={12} weight="fill" />
              </div>
            )}
          </div>
          <div className="grow flex flex-col">
            <div className="flex justify-between items-center">
              <Text as="span" size="2" weight="medium">
                {token.name}
              </Text>
              {renderBalance(balance)}
            </div>
            <div className="flex justify-between items-center text-gray-11">
              <Text as="span" size="2">
                {token.symbol}
              </Text>
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}

function renderBalance(balance: TokenValue | undefined) {
  return (
    <Text as="span" size="2" weight="medium">
      {balance != null
        ? formatTokenValue(balance.amount, balance.decimals, {
            min: 0.0001,
            fractionDigits: 4,
          })
        : null}
    </Text>
  )
}
