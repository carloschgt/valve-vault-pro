import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputUppercaseProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const InputUppercase = React.forwardRef<HTMLInputElement, InputUppercaseProps>(
  ({ className, type, onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Convert to uppercase for text inputs
      if (type !== 'number' && type !== 'email' && type !== 'password') {
        e.target.value = e.target.value.toUpperCase();
      }
      onChange?.(e);
    };

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm uppercase",
          className
        )}
        onChange={handleChange}
        ref={ref}
        {...props}
      />
    );
  }
);
InputUppercase.displayName = "InputUppercase";

export { InputUppercase };
