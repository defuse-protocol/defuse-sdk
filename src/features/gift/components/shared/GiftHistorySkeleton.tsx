import { Container, Flex, Skeleton } from "@radix-ui/themes"

export function GiftHistorySkeleton() {
  return (
    <Container size="1">
      <Flex direction="column" gap="2">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </Flex>
    </Container>
  )
}
