import React from "react"

import { BaseTokenInfo } from "src/types/base"

const AssetComboIcon = ({
  icon,
  name,
  chainIcon,
  chainName,
}: Omit<Partial<BaseTokenInfo>, "balance" | "balanceUsd">) => {
  return (
    <div className="relative inline-block">
      <div className="relative overflow-hidden w-[36px] h-[36px] flex justify-center items-center border border-silver-100 rounded-full">
        <img
          src={icon ?? "/static/icons/fallback-img.svg"}
          alt={name || "Coin Logo"}
          className="w-full h-full object-contain"
        />
      </div>
      <div className="absolute bottom-0 -right-[7px] flex justify-center items-center p-[3px] bg-black-300 rounded-full border border-white dark:border-black-950 w-[18px] h-[18px]">
        <div className="relative w-[16px] h-[16px]">
          <img
            src={chainIcon ?? "/static/icons/fallback-img.svg"}
            alt={`${chainName || "Network"} logo`}
            className="w-full h-full object-contain"
          />
        </div>
      </div>
    </div>
  )
}

export default AssetComboIcon
