import { Container, Flex, Skeleton, Text } from "@radix-ui/themes"
import {} from "react"
import type { SignerCredentials } from "../../../core/formatters"
import { userAddressToDefuseUserId } from "../../../utils/defuse"
import { useGiftMakerHistory } from "../stores/giftMakerHistory"
import type { GiftPayload } from "../types/sharedTypes"
import { GiftMakerHistoryItem } from "./shared/GiftMakerHistoryItem"

export function GiftMakerHistory({
  signerCredentials,
  generateLink,
}: {
  signerCredentials: SignerCredentials
  generateLink: (giftPayload: GiftPayload) => string
}) {
  const gifts = useGiftMakerHistory((s) => {
    const userId = userAddressToDefuseUserId(
      signerCredentials.credential,
      signerCredentials.credentialType
    )
    return s.gifts[userId]
  })

  if (gifts === undefined) {
    return <GiftMakerHistorySkeleton />
  }

  if (gifts == null || gifts.length === 0) {
    return <div className="flex flex-col gap-2.5">No pending gifts found</div>
  }

  return (
    <div className="flex flex-col gap-2.5">
      {gifts.map((giftInfo) => (
        <GiftMakerHistoryItem
          key={giftInfo.giftId}
          giftInfo={giftInfo}
          generateLink={generateLink}
        />
      ))}
    </div>
  )
}

function GiftMakerHistorySkeleton() {
  return (
    <Container size="1">
      <Flex direction="column" gap="2">
        <Skeleton>
          <Text>Lorem ipsum dolor sit amet</Text>
        </Skeleton>
        <Skeleton>
          <Text>Lorem ipsum dolor sit amet</Text>
        </Skeleton>
      </Flex>
    </Container>
  )
}
