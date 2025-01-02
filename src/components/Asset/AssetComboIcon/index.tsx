import styles from "./styles.module.css"

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
    <div className={styles.container}>
      <div className={styles.iconWrapper}>
        {icon ? (
          <img src={icon} alt={name || "Coin Logo"} className={styles.icon} />
        ) : (
          <EmptyAssetComboIcon />
        )}
      </div>
      {showChainIcon && (
        <div className={styles.chainIconWrapper}>
          {chainIcon ? (
            <img
              src={chainIcon}
              alt={chainName || "Network Logo"}
              className={styles.chainIcon}
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
  return <div className={styles.iconWrapper} />
}

const EmptyChainIcon = () => {
  return <div className={styles.emptyChainIcon} />
}
