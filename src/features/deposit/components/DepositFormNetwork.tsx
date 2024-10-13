import { useForm } from "react-hook-form"

import { Button, Spinner, Text } from "@radix-ui/themes"
import { Form } from "src/components/Form"
import { Select } from "src/components/Select/Select"
import type {
  BlockchainEnum,
  DepositFormNetworkProps,
  DepositFormNetworkValues,
} from "../../../types/deposit"

export const DepositFormNetwork = ({
  blockchains,
  onSubmit,
}: DepositFormNetworkProps) => {
  const {
    handleSubmit,
    register,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DepositFormNetworkValues>({ reValidateMode: "onSubmit" })

  return (
    <div className="w-full md:max-w-[472px] rounded-[1rem] p-5 shadow-paper bg-white dark:shadow-paper-dark dark:bg-black-800">
      <Form<DepositFormNetworkValues>
        handleSubmit={handleSubmit((values: DepositFormNetworkValues) =>
          onSubmit(values)
        )}
        register={register}
      >
        <div className="mb-4">
          <Select<BlockchainEnum>
            options={blockchains}
            value={watch("blockchain")}
            placeholder={{ label: "Select network", icon: null }}
            onChange={(value: string) =>
              setValue("blockchain", value as BlockchainEnum)
            }
            fullWidth
          />
        </div>
        <div className="space-y-4">
          <Button
            variant="classic"
            size="3"
            radius="large"
            className="w-full h-[56px]"
            color="orange"
          >
            <div className="flex justify-center items-center gap-2">
              <Spinner loading={false} />
              <Text size="6">Generate deposit address</Text>
            </div>
          </Button>
          <Button
            variant="classic"
            size="3"
            radius="large"
            className="w-full h-[56px]"
          >
            <div className="flex justify-center items-center gap-2">
              <Spinner loading={false} />
              <Text size="6">Deposit via Near</Text>
            </div>
          </Button>
        </div>
      </Form>
    </div>
  )
}
