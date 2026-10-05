import * as RadixDialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

/**
 * Headless Radix dialog wrapper (docs/11: no widget library, dialogs use Radix
 * primitives). Used for the settings sheet, withdrawal confirmation, and the
 * "use the mouse instead" prompt in failure state 1.
 * TODO Phase D, doc 13 Phase 4: style with tokens, honour reduced motion.
 */
export type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
};

export function Dialog({ open, onOpenChange, title, children }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay data-todo="ui/dialog overlay: Phase D" />
        <RadixDialog.Content data-todo="ui/dialog content: Phase D">
          <RadixDialog.Title>{title}</RadixDialog.Title>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
