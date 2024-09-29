import React from "react"

import { BaseTokenInfo } from "../../types/base"

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
          src={icon ?? ""}
          alt={name || "Coin Logo"}
          className="w-full h-full object-contain"
        />
      </div>
      <div className="absolute bottom-0 -right-[7px] flex justify-center items-center p-1 bg-black-300 rounded-full border-2 border-white dark:border-black-950">
        <img
          src={chainIcon ?? ""}
          alt={chainName || "Network Logo"}
          className="w-[6px] h-[6px]"
        />
      </div>
    </div>
  )
}

export default AssetComboIcon
