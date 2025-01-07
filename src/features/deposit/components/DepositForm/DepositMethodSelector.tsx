import { Button } from "@radix-ui/themes"
import clsx from "clsx"

type DepositMethod = "active" | "passive"

interface DepositMethodSelectorProps {
  selectedDepositOption: DepositMethod
  isActiveDepositAvailable: boolean
  isPassiveDepositAvailable: boolean
  onSelectDepositOption: (method: DepositMethod) => void
}

export function DepositMethodSelector({
  selectedDepositOption,
  isActiveDepositAvailable,
  isPassiveDepositAvailable,
  onSelectDepositOption,
}: DepositMethodSelectorProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="font-bold text-gray-950 text-sm">
        Choose deposit method
      </div>

      <div className="flex items-stretch gap-2">
        <Button
          type="button"
          onClick={() => onSelectDepositOption("passive")}
          disabled={!isPassiveDepositAvailable}
          size="4"
          variant={selectedDepositOption === "passive" ? "surface" : "outline"}
          color={selectedDepositOption === "passive" ? undefined : "gray"}
          className={clsx("flex-1 font-bold text-sm", {
            "ring-2 ring-accent-a700 ring-inset":
              selectedDepositOption === "passive",
          })}
        >
          Exchange
        </Button>
        <Button
          type="button"
          onClick={() => onSelectDepositOption("active")}
          disabled={!isActiveDepositAvailable}
          size="4"
          variant={selectedDepositOption === "active" ? "surface" : "outline"}
          color={selectedDepositOption === "active" ? undefined : "gray"}
          className={clsx("flex-1 font-bold text-sm", {
            "ring-2 ring-accent-a700 ring-inset":
              selectedDepositOption === "active",
          })}
        >
          Wallet
        </Button>
      </div>
    </div>
  )
}
