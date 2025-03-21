import { cn } from "src/utils/cn"

type TradeNavigationLinksProps = {
  onNavigateSwap?: () => void
  onNavigateOTC?: () => void
}

const TradeNavigationLinks = ({
  onNavigateSwap,
  onNavigateOTC,
}: TradeNavigationLinksProps) => {
  return (
    <div className="flex flex-row justify-around items-center border-b rounded-t-2xl border-gray-4 overflow-hidden -mx-5 -mt-5">
      <button
        type="button"
        onClick={onNavigateSwap}
        disabled={!onNavigateSwap}
        className={cn(
          "flex flex-1 justify-center items-center h-[68px] hover:bg-gray-3 border-b-[3px] box-border text-2xl font-black leading-7",
          !onNavigateSwap && "border-gray-12",
          onNavigateSwap && "border-transparent text-gray-10"
        )}
      >
        Swap
      </button>
      <button
        type="button"
        onClick={onNavigateOTC}
        disabled={!onNavigateOTC}
        className={cn(
          "flex flex-1 justify-center items-center h-[68px] hover:bg-gray-3 border-b-[3px] box-border text-2xl font-black leading-7",
          !onNavigateOTC && "border-gray-12",
          onNavigateOTC && "border-transparent text-gray-10"
        )}
      >
        OTC
      </button>
    </div>
  )
}

export { TradeNavigationLinks }
