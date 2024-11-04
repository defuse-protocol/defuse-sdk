import { TooltipProvider } from "@radix-ui/react-tooltip"
import * as Tooltip from "@radix-ui/react-tooltip"
import styles from "./styles.module.css"

export const TooltipInfo = ({
  children,
  icon,
}: { children: React.ReactNode; icon: React.ReactNode }) => (
  <div className={styles.tooltipInfoWrapper}>
    <TooltipProvider>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{icon}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="TooltipContent" sideOffset={5}>
            <div className={styles.tooltipInfo}>{children}</div>
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </TooltipProvider>
  </div>
)
