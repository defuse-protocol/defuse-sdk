import { HourglassHigh } from "@phosphor-icons/react"
import { Button, Dialog, Spinner } from "@radix-ui/themes"
import { useSelector } from "@xstate/react"
import type { ActorRefFrom } from "xstate"
import { AssetComboIcon } from "../../../components/Asset/AssetComboIcon"
import { ButtonCustom } from "../../../components/Button/ButtonCustom"
import { ModalDialog } from "../../../components/Modal/ModalDialog"
import type { SignerCredentials } from "../../../core/formatters"
import type { MultiPayload } from "../../../types/defuse-contracts-types"
import { formatTokenValue } from "../../../utils/format"
import type { otcMakerConfigLoadActor } from "../actors/otcMakerConfigLoadActor"
import type { otcMakerReadyOrderActor } from "../actors/otcMakerReadyOrderActor"
import type { SignMessage } from "../types/sharedTypes"
import { computeTradeBreakdown } from "../utils/otcMakerBreakdown"

type OtcMakerReadyOrderDialogProps = {
  configRef: ActorRefFrom<typeof otcMakerConfigLoadActor>
  readyOrderRef: ActorRefFrom<typeof otcMakerReadyOrderActor>
  signerCredentials: SignerCredentials
  signMessage: SignMessage
  generateLink: (multiPayload: MultiPayload) => string
}

export function OtcMakerReadyOrderDialog({
  configRef,
  readyOrderRef,
  signerCredentials,
  signMessage,
  generateLink,
}: OtcMakerReadyOrderDialogProps) {
  const { orderCancellationRef } = useSelector(readyOrderRef, (state) => ({
    orderCancellationRef: state.children.otcMakerOrderCancellationRef,
  }))

  const orderCancellationSnapshot = useSelector(
    orderCancellationRef,
    (state) => state
  )

  return (
    <>
      <OrderDialog
        readyOrderRef={readyOrderRef}
        configRef={configRef}
        generateLink={generateLink}
      />

      {orderCancellationRef && orderCancellationSnapshot && (
        <ModalDialog
          onClose={() =>
            orderCancellationRef.send({ type: "ABORT_CANCELLATION" })
          }
        >
          {orderCancellationSnapshot.matches("idleUncancellable") ? (
            <>
              <div>This order is either already cancelled or executed.</div>

              <Button
                type="button"
                onClick={() => {
                  orderCancellationRef.send({
                    type: "ACK_CANCELLATION_IMPOSSIBLE",
                  })
                }}
              >
                Ok
              </Button>
            </>
          ) : (
            <>
              <Dialog.Title className="text-2xl font-black text-gray-900 dark:text-gray-100 mb-2">
                Cancel order?
              </Dialog.Title>
              <Dialog.Description className="text-sm font-medium text-gray-600 dark:text-gray-400">
                The funds will stay safely in your wallet, and the link will no
                longer work.
              </Dialog.Description>

              {orderCancellationSnapshot.context.error != null && (
                <div className="text-red-700">
                  {orderCancellationSnapshot.context.error?.reason}
                </div>
              )}

              <div className="flex flex-col md:flex-row justify-center gap-3 mt-5">
                <Button
                  type="button"
                  size="4"
                  variant="outline"
                  className="flex-1 font-bold"
                  onClick={() =>
                    orderCancellationRef.send({ type: "ABORT_CANCELLATION" })
                  }
                >
                  Keep
                </Button>

                <Button
                  type="button"
                  size="4"
                  variant="solid"
                  className="flex-1 font-bold"
                  onClick={() =>
                    orderCancellationRef.send({
                      type: "CONFIRM_CANCELLATION",
                      signerCredentials,
                      signMessage,
                    })
                  }
                >
                  <Spinner
                    loading={orderCancellationSnapshot?.matches("cancelling")}
                  />
                  {orderCancellationSnapshot?.matches("cancelling")
                    ? "Cancelling..."
                    : "Cancel order"}
                </Button>
              </div>
            </>
          )}
        </ModalDialog>
      )}
    </>
  )
}

function OrderDialog({
  readyOrderRef,
  configRef,
  generateLink,
}: {
  readyOrderRef: ActorRefFrom<typeof otcMakerReadyOrderActor>
  configRef: ActorRefFrom<typeof otcMakerConfigLoadActor>
  generateLink: (multiPayload: MultiPayload) => string
}) {
  const { context } = useSelector(readyOrderRef, (state) => ({
    context: state.context,
  }))

  const fee = useSelector(configRef, (state) => state.context.fee)

  const finish = () => {
    readyOrderRef.send({ type: "FINISH" })
  }

  const cancelOrder = () => {
    readyOrderRef.send({ type: "CANCEL_ORDER" })
  }

  const breakdown =
    fee != null
      ? computeTradeBreakdown({
          amountIn: context.parsed.amountIn,
          amountOut: context.parsed.amountOut,
          fee,
        })
      : null

  return (
    <ModalDialog onClose={finish}>
      {/* Header Section */}
      <div className="flex flex-col items-center text-center mb-6">
        <div className="w-[64px] h-[64px] mt-5 mb-4 flex items-center justify-center rounded-full bg-yellow-300">
          <HourglassHigh
            className="size-7 text-warning-foreground"
            weight="bold"
          />
        </div>
        <Dialog.Title className="text-2xl font-black text-gray-900 dark:text-gray-100 mb-2">
          Your order is open
        </Dialog.Title>
        <Dialog.Description className="text-sm font-medium text-gray-600 dark:text-gray-400">
          Share the link with the recipient to finalize the swap.
        </Dialog.Description>
      </div>

      {/* Order Section */}
      {breakdown != null && (
        <div className="flex justify-between items-center gap-2 px-4 py-3.5 rounded-lg bg-gray-50 mb-4">
          <div className="flex items-center">
            <div className="flex items-center relative">
              <AssetComboIcon {...context.parsed.tokenIn} />
              <div className="flex relative items-center -left-[10px] z-10">
                <AssetComboIcon {...context.parsed.tokenOut} />
              </div>
            </div>
            <div className="text-sm text-a12 font-bold">Swap</div>
          </div>
          <div className="text-xs text-a12">
            {formatTokenValue(
              breakdown.makerSends.amount,
              breakdown.makerSends.decimals
              // biome-ignore lint/nursery/useConsistentCurlyBraces: <explanation>
            )}{" "}
            {context.parsed.tokenIn.symbol}
            {/* biome-ignore lint/nursery/useConsistentCurlyBraces: <explanation> */}
            {" → "}
            <span className="font-bold">
              {formatTokenValue(
                breakdown.makerReceives.amount,
                breakdown.makerReceives.decimals
                // biome-ignore lint/nursery/useConsistentCurlyBraces: <explanation>
              )}{" "}
              {context.parsed.tokenOut.symbol}
            </span>
          </div>
        </div>
      )}

      {breakdown != null && (
        <div className="flex flex-col gap-3.5 px-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-11 font-medium">You send</div>
            <div className="text-sm text-gray-12 font-medium">
              {formatTokenValue(
                breakdown.makerSends.amount,
                breakdown.makerSends.decimals
                // biome-ignore lint/nursery/useConsistentCurlyBraces: <explanation>
              )}{" "}
              {context.parsed.tokenIn.symbol}
            </div>
          </div>

          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-11 font-medium">
              Processing fee
            </div>
            <div className="text-sm text-gray-12 font-medium">
              {formatTokenValue(
                breakdown.makerPaysFee.amount,
                breakdown.makerPaysFee.decimals
                // biome-ignore lint/nursery/useConsistentCurlyBraces: <explanation>
              )}{" "}
              {context.parsed.tokenIn.symbol}
            </div>
          </div>

          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-11 font-medium">
              Recipient will get
            </div>
            <div className="text-sm text-gray-12 font-medium">
              {formatTokenValue(
                breakdown.takerReceives.amount,
                breakdown.takerReceives.decimals
                // biome-ignore lint/nursery/useConsistentCurlyBraces: <explanation>
              )}{" "}
              {context.parsed.tokenIn.symbol}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col justify-center gap-3 mt-5">
        <ButtonCustom
          type="button"
          size="lg"
          variant="primary"
          onClick={() => {
            navigator.clipboard.writeText(generateLink(context.multiPayload))
          }}
        >
          Copy link
        </ButtonCustom>

        <ButtonCustom
          size="lg"
          type="button"
          variant="secondary"
          onClick={cancelOrder}
        >
          Cancel order
        </ButtonCustom>
      </div>
    </ModalDialog>
  )
}
