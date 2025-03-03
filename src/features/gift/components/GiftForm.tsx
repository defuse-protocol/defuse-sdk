import { useActorRef, useSelector } from "@xstate/react"
import { useMemo } from "react"
import type { SnapshotFrom } from "xstate"
import { ButtonCustom } from "../../../components/Button/ButtonCustom"
import type { SignerCredentials } from "../../../core/formatters"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../../types/base"
import type { MultiPayload } from "../../../types/defuse-contracts-types"
import type { ChainType } from "../../../types/deposit"
import { assert } from "../../../utils/assert"
import { balanceAllSelector } from "../../machines/depositedBalanceMachine"
import type { SendNearTransaction } from "../../machines/publicKeyVerifierMachine"
import { formValuesSelector } from "../actors/giftFormMachine"
import { giftRootMachine } from "../actors/giftRootMachine"
import type { SignMessage } from "../types/sharedTypes"

export type GiftWidgetProps = {
  /** List of available tokens for trading */
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]

  /** User's wallet address */
  userAddress: string | null | undefined
  userChainType: ChainType | null | undefined

  /** Initial tokens for pre-filling the form */
  initialTokenIn?: BaseTokenInfo | UnifiedTokenInfo

  /** Sign message callback */
  signMessage: SignMessage

  /** Send NEAR transaction callback */
  sendNearTransaction: SendNearTransaction

  /** Function to generate a shareable trade link */
  generateLink: (multiPayload: MultiPayload) => string

  /** Theme selection */
  theme?: "dark" | "light"

  /** Frontend referral */
  referral?: string
}

export function GiftForm({
  tokenList,
  userAddress,
  userChainType,
  initialTokenIn,
  signMessage,
  // biome-ignore lint/correctness/noUnusedVariables: <explanation>
  sendNearTransaction,
  // biome-ignore lint/correctness/noUnusedVariables: <explanation>
  generateLink,
  referral,
}: GiftWidgetProps) {
  const signerCredentials: SignerCredentials | null = useMemo(
    () =>
      userAddress != null && userChainType != null
        ? {
            credential: userAddress,
            credentialType: userChainType,
          }
        : null,
    [userAddress, userChainType]
  )

  const initialTokenIn_ = initialTokenIn ?? tokenList[0]
  assert(initialTokenIn_ !== undefined, "Token list must not be empty")

  const rootActorRef = useActorRef(giftRootMachine, {
    input: {
      initialTokenIn: initialTokenIn_,
      tokenList,
      referral,
    },
  })

  const formRef = useSelector(rootActorRef, (s) => s.context.formRef)
  const formValuesRef = useSelector(formRef, formValuesSelector)
  const formValues = useSelector(formValuesRef, (s) => s.context)

  // biome-ignore lint/correctness/noUnusedVariables: <explanation>
  const { tokenInBalance } = useSelector(
    useSelector(rootActorRef, (s) => s.context.depositedBalanceRef),
    balanceAllSelector({
      tokenInBalance: formValues.tokenIn,
    })
  )

  const rootSnapshot = useSelector(rootActorRef, (s) => s)

  return (
    <div className="flex flex-col p-5">
      <form
        onSubmit={(e) => {
          e.preventDefault()

          if (signerCredentials != null) {
            rootActorRef.send({
              type: "REQUEST_SIGN",
              signMessage,
              signerCredentials,
            })
          }
        }}
        className="flex flex-col gap-5"
      >
        <div className="flex flex-col items-center">
          <div className="flex flex-col gap-3">
            {renderSubmitButton(rootSnapshot)}
          </div>
        </div>
      </form>
    </div>
  )
}

function renderSubmitButton(snapshot: SnapshotFrom<typeof giftRootMachine>) {
  let caption = "Create swap link"

  switch (true) {
    case snapshot.matches("editing"):
      caption = "Create gift link"
      break
    case snapshot.matches("signing"):
      caption = "Confirm transaction in your wallet..."
      break
  }

  return (
    <ButtonCustom
      type="submit"
      size="lg"
      variant={snapshot.matches("signing") ? "secondary" : "primary"}
      isLoading={snapshot.matches("signing")}
    >
      {caption}
    </ButtonCustom>
  )
}
