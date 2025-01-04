type AssetComboIconProps = {
  icon?: string
  name?: string
  chainIcon?: string
  chainName?: string
  showChainIcon?: boolean
}

export const AssetComboIcon = ({
  icon,
  name,
  chainIcon,
  chainName,
  showChainIcon = false,
}: AssetComboIconProps) => {
  return (
    <div className="relative inline-block">
      <div className="relative overflow-hidden w-9 h-9 flex justify-center items-center rounded-full">
        {icon ? (
          <img
            src={icon}
            alt={name || "Coin Logo"}
            className="w-full h-full object-contain"
          />
        ) : (
          <EmptyAssetComboIcon />
        )}
      </div>
      {showChainIcon && (
        <div className="absolute -right-[7px] bottom-0 flex justify-center items-center p-1 bg-black-300 rounded-full border-2 border-white dark:border-black-950">
          {chainIcon ? (
            <img
              src={chainIcon}
              alt={chainName || "Network Logo"}
              className="w-[6px] h-[6px]"
            />
          ) : (
            <EmptyChainIcon />
          )}
        </div>
      )}
    </div>
  )
}

const EmptyAssetComboIcon = () => {
  return (
    <div className="relative overflow-hidden w-9 h-9 flex justify-center items-center border border-silver-100 rounded-full" />
  )
}

const EmptyChainIcon = () => {
  return (
    <div className="w-[6px] h-[6px] flex justify-center items-center bg-black-300 rounded-full border-2 border-white dark:border-black-950" />
  )
}
