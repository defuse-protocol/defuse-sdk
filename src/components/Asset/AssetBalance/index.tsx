type AssetBalanceProps = {
  balance: string
}

export const AssetBalance = ({ balance }: AssetBalanceProps) => (
  <div>
    {balance !== "0"
      ? Number(balance) < 0.00001
        ? "< 0.00001"
        : Number(balance).toFixed(7)
      : null}
  </div>
)
