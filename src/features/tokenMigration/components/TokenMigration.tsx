import { useState } from "react"
import type { AuthMethod } from "../../../types/authHandle"
import { assert } from "../../../utils/assert"
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
  const [enabled, setEnabled] = useState(
    userAddress != null && userChainType != null
  )

  if (!enabled) {
    return null
  }

  assert(userAddress != null && userChainType != null)

  return (
    <TokenMigrationDialog
      userAddress={userAddress}
      userChainType={userChainType}
      signMessage={signMessage}
      onExit={() => setEnabled(false)}
    />
  )
}
