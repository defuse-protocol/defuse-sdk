import React, {PropsWithChildren} from "react"

interface CustomButtonButtonProps extends PropsWithChildren {
  onClick?: () => void
}

const CustomButton: React.FC<CustomButtonButtonProps> = ({ children, onClick }) => {
  return <button onClick={onClick}>{children}</button>
}

export default CustomButton
