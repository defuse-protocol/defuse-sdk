import type { AuthMethod } from "../../../types/authHandle"
import type { SignMessage } from "../../otcDesk/types/sharedTypes"
import { TokenMigrationDialog } from "./TokenMigrationDialog"

interface TokenMigrationProps {
  /** User's wallet address */
  userAddress: string | null | undefined
  userChainType: AuthMethod | null | undefined

  signMessage: SignMessage
}

export function TokenMigration({
  userAddress,
  userChainType,
  signMessage,
}: TokenMigrationProps) {
  if (userAddress == null || userChainType == null) {
    return null
  }

  return (
    <TokenMigrationDialog
      userAddress={userAddress}
      userChainType={userChainType}
      signMessage={signMessage}
    />
  )
}
