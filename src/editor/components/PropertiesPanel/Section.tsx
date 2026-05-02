/**
 * Section — shared collapsible section primitive.
 *
 * Extracted from ClassComposer.tsx so that PropertiesPanel can reuse the
 * same section header + toggle + content styling (PP-6 acceptance criterion).
 *
 * Used by:
 *   - PropertiesPanel.tsx (Module settings)
 *   - ClassComposer.tsx (assigned class style categories)
 *
 * The optional `indicator` prop renders a small dot to signal state (e.g.
 * breakpoint overrides active, or category contains stored styles).
 */

import { useState } from "react";
import type { IconComponent } from "@ui/icons/types";
import { cn } from "@ui/cn";
import styles from "./Section.module.css";

interface SectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  /** Render a small accent dot (e.g. 'bp' = breakpoint active, 'set' = stored styles). */
  indicator?: "bp" | "set" | undefined;
  indicatorTestId?: string;
  icon?: IconComponent;
  meta?: React.ReactNode;
  forceOpen?: boolean;
}

export function Section({
  title,
  children,
  defaultOpen = false,
  indicator,
  indicatorTestId,
  icon: SectionIcon,
  meta,
  forceOpen = false,
}: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const expanded = forceOpen || open;

  return (
    <div className={cn(styles.section, expanded && styles.sectionOpen)}>
      <button
        onClick={() => {
          if (!forceOpen) setOpen((o) => !o);
        }}
        className={styles.sectionToggle}
        aria-expanded={expanded}
      >
        {SectionIcon && (
          <span className={styles.sectionIcon}>
            <SectionIcon size={13} />
          </span>
        )}
        <span className={styles.sectionTitleGroup}>
          <span className={styles.sectionTitle}>{title}</span>
          {indicator === "set" && (
            <span
              className={cn(styles.sectionIndicatorDot, styles.sectionSetIndicatorDot)}
              data-testid={indicatorTestId}
              aria-hidden="true"
            />
          )}
        </span>
        {meta && <span className={styles.sectionMeta}>{meta}</span>}
        {indicator === "bp" && (
          <span
            className={styles.sectionIndicatorDot}
            data-testid={indicatorTestId}
            aria-hidden="true"
          />
        )}
      </button>
      {expanded && <div className={styles.sectionContent}>{children}</div>}
    </div>
  );
}
