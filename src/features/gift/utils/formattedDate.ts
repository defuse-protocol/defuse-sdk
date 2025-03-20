import { logger } from "../../../logger"

export function formatGiftDate(dateString: number): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(dateString))
  } catch (error) {
    logger.error(
      new Error("Failed to format Gift updatedAt date", { cause: error })
    )
    return "-"
  }
}
