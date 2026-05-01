import { forwardRef, type InputHTMLAttributes } from "react";
import { Button } from "@ui/components/Button";
import { Input } from "@ui/components/Input";
import { CloseIcon } from "@ui/icons/icons/close";
import { SearchIcon } from "@ui/icons/icons/search";
import { cn } from "@ui/cn";
import styles from "./SearchBar.module.css";

interface SearchBarProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "size" | "value" | "onChange"
> {
  value: string;
  onValueChange: (value: string) => void;
  onClear?: () => void;
  fieldSize?: "xs" | "sm" | "md";
  clearLabel?: string;
  inputClassName?: string;
}

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  function SearchBar(
    {
      value,
      onValueChange,
      onClear,
      fieldSize = "sm",
      clearLabel = "Clear search",
      className,
      inputClassName,
      ...inputProps
    },
    ref,
  ) {
    function handleClear() {
      if (onClear) onClear();
      else onValueChange("");
    }

    return (
      <div className={cn(styles.searchBar, className)}>
        <SearchIcon
          size={11}
          color="var(--editor-text-subtle)"
          aria-hidden="true"
        />
        <Input
          ref={ref}
          type="search"
          fieldSize={fieldSize}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          className={cn(styles.input, inputClassName)}
          {...inputProps}
        />
        {value && (
          <Button
            variant="ghost"
            size="xs"
            iconOnly
            onClick={handleClear}
            aria-label={clearLabel}
          >
            <CloseIcon size={10} aria-hidden="true" />
          </Button>
        )}
      </div>
    );
  },
);
