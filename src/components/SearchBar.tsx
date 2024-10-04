import { Cross1Icon, MagnifyingGlassIcon } from "@radix-ui/react-icons"
import React from "react"

type Props = {
  query: string
  setQuery: (value: string) => void
  placeholder?: string
  handleOverrideCancel?: () => void
}

export const SearchBar = ({
  query,
  setQuery,
  handleOverrideCancel,
  placeholder = "Search name or paste address",
}: Props) => {
  return (
    <div className="flex justify-between items-center gap-4">
      <MagnifyingGlassIcon width={18} height={18} />
      <input
        className="flex-1 border-transparent focus:border-transparent focus:ring-0 dark:bg-black-800 dark:text-white"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <button
        type={"button"}
        onClick={() => {
          handleOverrideCancel ? handleOverrideCancel() : setQuery("")
        }}
      >
        <Cross1Icon width={14} height={14} />
      </button>
    </div>
  )
}
