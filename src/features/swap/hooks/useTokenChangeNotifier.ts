import { useEffect } from "react"
import type { SwappableToken } from "../../../types/swap"
import { SwapUIMachineContext } from "../components/SwapUIMachineProvider"

export function useTokenChangeNotifier({
  onTokenChange,
  prevTokensRef,
}: {
  onTokenChange?: (params: {
    tokenIn: SwappableToken | null
    tokenOut: SwappableToken | null
  }) => void
  prevTokensRef: React.MutableRefObject<{
    tokenIn: SwappableToken
    tokenOut: SwappableToken
  }>
}) {
  const { tokenIn, tokenOut } = SwapUIMachineContext.useSelector(
    (snapshot) => ({
      tokenIn: snapshot.context.formValues.tokenIn,
      tokenOut: snapshot.context.formValues.tokenOut,
    })
  )

  useEffect(() => {
    if (
      onTokenChange &&
      (tokenIn !== prevTokensRef.current.tokenIn ||
        tokenOut !== prevTokensRef.current.tokenOut)
    ) {
      onTokenChange({
        tokenIn,
        tokenOut,
      })
      prevTokensRef.current = { tokenIn, tokenOut }
    }
  }, [tokenIn, tokenOut, onTokenChange, prevTokensRef])
}
