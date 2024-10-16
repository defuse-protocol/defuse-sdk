import { QRCodeSVG } from "qrcode.react"
import type { BlockchainEnum } from "../../../../../types/deposit"
import styles from "./styles.module.css"

type DepositFormGenerateAddressProps = {
  blockchain: BlockchainEnum
  address: string
  onBack: () => void
}

export const DepositFormGenerateAddress = ({
  blockchain,
  address,
  onBack,
}: DepositFormGenerateAddressProps) => {
  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Deposit {blockchain}</h2>
      <p className={styles.instruction}>Send your funds to this address:</p>
      <div className={styles.qrCodeWrapper}>
        <QRCodeSVG value={address} />
      </div>
      <p className={styles.address}>{address}</p>
      <button type="button" onClick={onBack} className={styles.backButton}>
        Back
      </button>
    </div>
  )
}
