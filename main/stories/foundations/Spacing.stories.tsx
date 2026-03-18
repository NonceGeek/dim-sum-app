import type { Meta, StoryObj } from "@storybook/react";
import React from "react";

/* ---------------------------------------------------------------------------
 * Data
 * ------------------------------------------------------------------------- */

const spacingTokens: { name: string; variable: string; px: string }[] = [
  { name: "0", variable: "--ds-spacing-0", px: "0px" },
  { name: "0.5", variable: "--ds-spacing-0-5", px: "2px" },
  { name: "1", variable: "--ds-spacing-1", px: "4px" },
  { name: "1.5", variable: "--ds-spacing-1-5", px: "6px" },
  { name: "2", variable: "--ds-spacing-2", px: "8px" },
  { name: "3", variable: "--ds-spacing-3", px: "12px" },
  { name: "4", variable: "--ds-spacing-4", px: "16px" },
  { name: "5", variable: "--ds-spacing-5", px: "20px" },
  { name: "6", variable: "--ds-spacing-6", px: "24px" },
  { name: "8", variable: "--ds-spacing-8", px: "32px" },
  { name: "10", variable: "--ds-spacing-10", px: "40px" },
  { name: "12", variable: "--ds-spacing-12", px: "48px" },
  { name: "16", variable: "--ds-spacing-16", px: "64px" },
  { name: "20", variable: "--ds-spacing-20", px: "80px" },
  { name: "24", variable: "--ds-spacing-24", px: "96px" },
];

/* ---------------------------------------------------------------------------
 * Story: AllSpacing
 * ------------------------------------------------------------------------- */

function AllSpacing() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
      <section>
        <h2
          style={{
            fontSize: "var(--ds-font-size-2xl)",
            fontWeight: "var(--ds-font-weight-bold)" as unknown as number,
            marginBottom: 8,
          }}
        >
          Spacing Scale
        </h2>
        <p
          style={{
            fontSize: "var(--ds-font-size-sm)",
            color: "var(--muted-foreground)",
            marginBottom: 24,
          }}
        >
          Base unit: 4px. All spacing values are multiples of the base unit.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {spacingTokens.map((token) => (
            <div
              key={token.variable}
              style={{ display: "flex", alignItems: "center", gap: 16 }}
            >
              {/* Label */}
              <div
                style={{
                  width: 200,
                  fontSize: "var(--ds-font-size-sm)",
                  fontFamily: "monospace",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontWeight:
                      "var(--ds-font-weight-semibold)" as unknown as number,
                  }}
                >
                  {token.name}
                </span>
                <span style={{ color: "var(--muted-foreground)", marginLeft: 8 }}>
                  {token.px}
                </span>
              </div>

              {/* Bar */}
              <div
                style={{
                  height: 24,
                  width: `var(${token.variable})`,
                  backgroundColor: "var(--primary)",
                  borderRadius: 4,
                  minWidth: token.name === "0" ? 0 : 2,
                  transition: "width 0.2s ease",
                }}
              />

              {/* Variable name */}
              <div
                style={{
                  fontSize: "var(--ds-font-size-xs)",
                  color: "var(--muted-foreground)",
                  fontFamily: "monospace",
                  whiteSpace: "nowrap",
                }}
              >
                var({token.variable})
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Meta
 * ------------------------------------------------------------------------- */

const meta: Meta = {
  title: "Foundations/Spacing",
};

export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => <AllSpacing />,
};
