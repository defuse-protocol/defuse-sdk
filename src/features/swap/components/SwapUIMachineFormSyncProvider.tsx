import { useSelector } from "@xstate/react"
import { type PropsWithChildren, useEffect, useRef } from "react"
import { useFormContext } from "react-hook-form"
import type { ModalConfirmAddPubkeyPayload } from "../../../components/Modal/ModalConfirmAddPubkey"
import { useModalStore } from "../../../providers/ModalStoreProvider"
import { ModalType } from "../../../stores/modalStore"
import type { SwapWidgetProps } from "../../../types"
import { assert } from "../../../utils/assert"
import type { SwapFormValues } from "./SwapForm"
import { SwapUIMachineContext } from "./SwapUIMachineProvider"

type SwapUIMachineFormSyncProviderProps = PropsWithChildren<{
  userAddress: string | null
  onSuccessSwap: SwapWidgetProps["onSuccessSwap"]
}>

export function SwapUIMachineFormSyncProvider({
  children,
  userAddress,
  onSuccessSwap,
}: SwapUIMachineFormSyncProviderProps) {
  const { watch, setValue } = useFormContext<SwapFormValues>()
  const actorRef = SwapUIMachineContext.useActorRef()

  // Make `onSuccessSwap` stable reference, waiting for `useEvent` hook to come out
  const onSuccessSwapRef = useRef(onSuccessSwap)
  onSuccessSwapRef.current = onSuccessSwap

  useEffect(() => {
    const sub = watch(async (value, { name }) => {
      if (name != null && name === "amountIn") {
        actorRef.send({
          type: "input",
          params: { [name]: value[name] },
        })
      }
    })
    return () => {
      sub.unsubscribe()
    }
  }, [watch, actorRef])

  useEffect(() => {
    if (userAddress == null) {
      actorRef.send({ type: "LOGOUT" })
    } else {
      actorRef.send({ type: "LOGIN", params: { accountId: userAddress } })
    }
  }, [actorRef, userAddress])

  useEffect(() => {
    const sub = actorRef.on("*", (event) => {
      switch (event.type) {
        case "INTENT_PUBLISHED": {
          setValue("amountIn", "")
          break
        }

        case "INTENT_SETTLED": {
          onSuccessSwapRef.current({
            amountIn: 0n, // todo: remove amount fields, as they may not exist for all types of intents
            amountOut: 0n,
            tokenIn: event.data.tokenIn,
            tokenOut: event.data.tokenOut,
            txHash: event.data.txHash,
            intentHash: event.data.intentHash,
          })
          break
        }
      }
    })

    return () => {
      sub.unsubscribe()
    }
  }, [actorRef, setValue])

  const { setModalType, onCloseModal } = useModalStore((state) => state)

  const swapRef = useSelector(actorRef, (state) => state.children.swapRef)
  const publicKeyVerifierRef = useSelector(swapRef, (state) => {
    if (state) {
      return state.children.publicKeyVerifierRef
    }
  })

  useEffect(() => {
    if (!publicKeyVerifierRef) return

    const sub = publicKeyVerifierRef.subscribe((snapshot) => {
      if (snapshot.matches("checked")) {
        assert(snapshot.context.nearAccount, "Near account is not set")

        setModalType(ModalType.MODAL_CONFIRM_ADD_PUBKEY, {
          accountId: snapshot.context.nearAccount.accountId,
          onConfirm: () => {
            publicKeyVerifierRef.send({ type: "ADD_PUBLIC_KEY" })
            onCloseModal()
          },
          onAbort: () => {
            console.log("send onAbort")
            publicKeyVerifierRef.send({ type: "ABORT_ADD_PUBLIC_KEY" })
          },
        } satisfies ModalConfirmAddPubkeyPayload)
      }
    })

    return () => {
      sub.unsubscribe()
    }
  }, [publicKeyVerifierRef, setModalType, onCloseModal])

  return <>{children}</>
}
