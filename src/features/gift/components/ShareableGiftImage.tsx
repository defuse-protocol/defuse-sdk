import { cn } from "src/utils/cn"
import type {
  BaseTokenInfo,
  TokenValue,
  UnifiedTokenInfo,
} from "../../../types/base"
import { GiftStrip } from "./GiftStrip"

type ShareableGiftImageProps = {
  token: BaseTokenInfo | UnifiedTokenInfo
  amount: TokenValue
  message: string
  className?: string
}

export function ShareableGiftImage({
  token,
  amount,
  message,
  className,
}: ShareableGiftImageProps) {
  return (
    <div
      className={cn(
        "relative w-full min-w-[334.22px] min-h-[188px] max-w-[600px] h-auto aspect-[1.9/1] rounded-xl flex flex-col justify-center p-10 items-center",
        className
      )}
      style={{
        backgroundImage: 'url("/static/images/gift-backing.svg")',
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundBlendMode: "overlay",
      }}
    >
      <div className="flex flex-col items-center gap-4 z-10">
        {/* Asset Component */}
        <div className="flex items-center gap-4 z-10 bg-white rounded-full p-1.5">
          <GiftStrip token={token} amount={amount} />
        </div>

        {/* Message Text */}
        <div className="text-white text-sm z-10 font-bold">{message}</div>
      </div>
    </div>
  )
}
