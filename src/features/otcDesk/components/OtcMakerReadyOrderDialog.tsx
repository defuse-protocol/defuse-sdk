import { Button, Spinner } from "@radix-ui/themes"
import { useSelector } from "@xstate/react"
import type { ActorRefFrom } from "xstate"
import { ModalDialog } from "../../../components/Modal/ModalDialog"
import type { SignerCredentials } from "../../../core/formatters"
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
}

export function OtcMakerReadyOrderDialog({
  configRef,
  readyOrderRef,
  signerCredentials,
  signMessage,
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
      <OrderDialog readyOrderRef={readyOrderRef} configRef={configRef} />

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
              <div>Are you sure you want to cancel the order?</div>

              {orderCancellationSnapshot.context.error != null && (
                <div className="text-red-700">
                  {orderCancellationSnapshot.context.error?.reason}
                </div>
              )}

              <Button
                type="button"
                onClick={() => {
                  orderCancellationRef.send({
                    type: "CONFIRM_CANCELLATION",
                    signerCredentials,
                    signMessage,
                  })
                }}
              >
                <Spinner
                  loading={orderCancellationSnapshot?.matches("cancelling")}
                />
                Yes
              </Button>

              <Button
                type="button"
                onClick={() =>
                  orderCancellationRef.send({ type: "ABORT_CANCELLATION" })
                }
              >
                No
              </Button>
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
}: {
  readyOrderRef: ActorRefFrom<typeof otcMakerReadyOrderActor>
  configRef: ActorRefFrom<typeof otcMakerConfigLoadActor>
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
      <div>Your order is open</div>
      <div>Share the link with the recipient to finalize the swap.</div>

      {breakdown != null && (
        <div>
          <div>Swap</div>
          <div>
            {formatTokenValue(
              breakdown.makerSends.amount,
              breakdown.makerSends.decimals
              // biome-ignore lint/nursery/useConsistentCurlyBraces: <explanation>
            )}{" "}
            {context.parsed.tokenIn.symbol}
            {/* biome-ignore lint/nursery/useConsistentCurlyBraces: <explanation> */}
            {" → "}
            {formatTokenValue(
              breakdown.makerReceives.amount,
              breakdown.makerReceives.decimals
              // biome-ignore lint/nursery/useConsistentCurlyBraces: <explanation>
            )}{" "}
            {context.parsed.tokenOut.symbol}
          </div>
        </div>
      )}

      {breakdown != null && (
        <div>
          <div>
            <div>You send</div>
            <div>
              {formatTokenValue(
                breakdown.makerSends.amount,
                breakdown.makerSends.decimals
                // biome-ignore lint/nursery/useConsistentCurlyBraces: <explanation>
              )}{" "}
              {context.parsed.tokenIn.symbol}
            </div>
          </div>

          <div>
            <div>Processing fee</div>
            <div>
              {formatTokenValue(
                breakdown.makerPaysFee.amount,
                breakdown.makerPaysFee.decimals
                // biome-ignore lint/nursery/useConsistentCurlyBraces: <explanation>
              )}{" "}
              {context.parsed.tokenIn.symbol}
            </div>
          </div>

          <div>
            <div>Recipient will get</div>
            <div>
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

      <Button type="button">Copy link</Button>

      <Button type="button" onClick={cancelOrder}>
        Cancel order
      </Button>
    </ModalDialog>
  )
}
