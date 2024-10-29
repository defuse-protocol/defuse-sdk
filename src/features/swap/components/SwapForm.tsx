import { Box } from "@radix-ui/themes"
import { useActorRef, useSelector } from "@xstate/react"
import { Fragment, useContext, useEffect } from "react"
import { useFormContext } from "react-hook-form"
import type { ActorRefFrom, SnapshotFrom } from "xstate"
import { ButtonCustom, ButtonSwitch } from "../../../components/Button"
import { Form } from "../../../components/Form"
import { FieldComboInput } from "../../../components/Form/FieldComboInput"
import { SwapIntentCard } from "../../../components/IntentCard/SwapIntentCard"
import type { ModalSelectAssetsPayload } from "../../../components/Modal/ModalSelectAssets"
import { useModalStore } from "../../../providers/ModalStoreProvider"
import { ModalType } from "../../../stores/modalStore"
import type { SwappableToken } from "../../../types"
import { isBaseToken } from "../../../utils"
import type { depositedBalanceMachine } from "../../machines/depositedBalanceMachine"
import { intentStatusMachine } from "../../machines/intentStatusMachine"
import type { Context } from "../../machines/swapUIMachine"
import { SwapSubmitterContext } from "./SwapSubmitter"
import { SwapUIMachineContext } from "./SwapUIMachineProvider"

export type SwapFormValues = {
  amountIn: string
  amountOut: string
}

export const SwapForm = () => {
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useFormContext<SwapFormValues>()

  const swapUIActorRef = SwapUIMachineContext.useActorRef()
  const snapshot = SwapUIMachineContext.useSelector((snapshot) => snapshot)
  const intentCreationResult = snapshot.context.intentCreationResult

  const { tokenIn, tokenOut } = SwapUIMachineContext.useSelector((snapshot) => {
    const tokenIn = snapshot.context.formValues.tokenIn

    return {
      tokenIn: tokenIn,
      tokenOut: snapshot.context.formValues.tokenOut,
    }
  })

  const switchTokens = () => {
    swapUIActorRef.send({
      type: "input",
      params: {
        tokenIn: tokenOut,
        tokenOut: tokenIn,
      },
    })
  }

  const { setModalType, payload, onCloseModal } = useModalStore(
    (state) => state
  )

  const openModalSelectAssets = (
    fieldName: string,
    selectToken: SwappableToken | undefined
  ) => {
    setModalType(ModalType.MODAL_SELECT_ASSETS, {
      fieldName,
      selectToken,
      balances: depositedBalanceRef?.getSnapshot().context.balances,
    })
  }

  useEffect(() => {
    if (
      (payload as ModalSelectAssetsPayload)?.modalType !==
      ModalType.MODAL_SELECT_ASSETS
    ) {
      return
    }
    const { modalType, fieldName, token } = payload as ModalSelectAssetsPayload
    if (modalType === ModalType.MODAL_SELECT_ASSETS && fieldName && token) {
      switch (fieldName) {
        case "tokenIn":
          swapUIActorRef.send({ type: "input", params: { tokenIn: token } })
          break
        case "tokenOut":
          swapUIActorRef.send({ type: "input", params: { tokenOut: token } })
          break
      }
      onCloseModal(undefined)
    }
  }, [payload, onCloseModal, swapUIActorRef])

  const { onSubmit } = useContext(SwapSubmitterContext)

  const depositedBalanceRef = useSelector(
    swapUIActorRef,
    (state) => state.children.depositedBalanceRef
  )

  const tokenInBalance = useSelector(
    depositedBalanceRef,
    balanceSelector(tokenIn)
  )

  const tokenOutBalance = useSelector(
    depositedBalanceRef,
    balanceSelector(tokenOut)
  )

  const balanceInsufficient =
    tokenInBalance != null
      ? tokenInBalance < snapshot.context.parsedFormValues.amountIn
      : null

  const intentRef = useActorRef(intentStatusMachine, {
    input: {
      // @ts-expect-error
      parentRef: swapUIActorRef,
      intentHash: "LiAqVEKaxWejXfoFe2Js8S+TygJt6hWJJ3+BVHVZ+GQ=",
      tokenIn,
      tokenOut,
      quote: {
        totalAmountIn: 13_123123n,
        totalAmountOut: 971_231233n,
        quoteHashes: [],
        expirationTime: 0,
        amountsIn: {},
        amountsOut: {},
      },
    },
  })

  // useEffect(() => {
  //   console.log(JSON.stringify(intentRef.getPersistedSnapshot()))
  // }, [intentRef])

  return (
    <div className="md:max-w-[472px] rounded-[1rem] p-5 shadow-paper bg-white dark:shadow-paper-dark dark:bg-black-800">
      <Form<SwapFormValues>
        handleSubmit={handleSubmit(onSubmit)}
        register={register}
      >
        <FieldComboInput<SwapFormValues>
          fieldName="amountIn"
          selected={tokenIn}
          handleSelect={() => {
            openModalSelectAssets("tokenIn", tokenOut)
          }}
          className="border rounded-t-xl"
          required="This field is required"
          errors={errors}
          balance={tokenInBalance}
        />

        <div className="relative w-full">
          <ButtonSwitch onClick={switchTokens} />
        </div>

        <FieldComboInput<SwapFormValues>
          fieldName="amountOut"
          selected={tokenOut}
          handleSelect={() => {
            openModalSelectAssets("tokenOut", tokenIn)
          }}
          className="border rounded-b-xl mb-5"
          required="This field is required"
          errors={errors}
          disabled={true}
          balance={tokenOutBalance}
        />

        {renderIntentCreationResult(intentCreationResult)}

        <ButtonCustom
          type="submit"
          size="lg"
          fullWidth
          isLoading={snapshot.matches("submitting")}
          disabled={!!balanceInsufficient}
        >
          {balanceInsufficient ? "Insufficient balance" : "Swap"}
        </ButtonCustom>
      </Form>

      <Box mt={"2"}>
        <Intents intentRefs={snapshot.context.intentRefs} />
      </Box>
    </div>
  )
}

function Intents({
  intentRefs,
}: { intentRefs: ActorRefFrom<typeof intentStatusMachine>[] }) {
  return (
    <div>
      {intentRefs.map((intentRef, i, list) => {
        return (
          <Fragment key={intentRef.id}>
            <SwapIntentCard intentStatusActorRef={intentRef} />
          </Fragment>
        )
      })}
    </div>
  )
}

function renderIntentCreationResult(
  intentCreationResult: Context["intentCreationResult"]
) {
  if (!intentCreationResult) {
    return null
  }

  const status = intentCreationResult.status
  switch (status) {
    case "INTENT_PUBLISHED":
      return null

    case "ERR_QUOTE_EXPIRED_RETURN_IS_LOWER":
      return <div className="text-red-500 text-sm">Missed deadline</div>

    case "ERR_CANNOT_PUBLISH_INTENT":
      return <div className="text-red-500 text-sm">Cannot publish intent</div>

    default:
      return <div className="text-red-500 text-sm">Swap failed! {status}</div>
  }
}

function balanceSelector(token: SwappableToken) {
  return (state: undefined | SnapshotFrom<typeof depositedBalanceMachine>) => {
    if (!state) return

    if (isBaseToken(token)) {
      return state.context.balances[token.defuseAssetId]
    }
    let total: undefined | bigint
    for (const innerToken of token.groupedTokens) {
      const v = state.context.balances[innerToken.defuseAssetId]
      if (v != null) {
        total ??= 0n
        total += v
      }
    }
    return total
  }
}
