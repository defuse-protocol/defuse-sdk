import React from "react"
import clsx from "clsx"

export const NetworkIcon = ({
  chainIcon,
  chainName,
  isConnect,
}: {
  chainIcon: string
  chainName: string
  isConnect?: boolean
}) => {
  return (
    <div className="relative inline-block">
      <div
        className={clsx(
          "relative overflow-hidden w-[36px] h-[36px] flex justify-center items-center border border-silver-100 rounded-full dark:border-white",
          chainName === "near" && "bg-black",
          chainName === "eth" && "bg-white",
          chainName === "btc" && "bg-white"
        )}
      >
        <img
          src={chainIcon}
          alt={chainName ?? "Network Logo"}
          className="w-5 h-5"
        />
      </div>
      {isConnect && (
        <div className="absolute bottom-0 -right-[7px]">
          <img
            src="/static/icons/success.svg"
            alt="Network Logo"
            className="w-[18px] h-[18px]"
          />
        </div>
      )}
    </div>
  )
}
