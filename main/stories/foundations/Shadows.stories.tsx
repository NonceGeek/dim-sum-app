import type { Meta, StoryObj } from "@storybook/react";
import React from "react";

/* ---------------------------------------------------------------------------
 * Data
 * ------------------------------------------------------------------------- */

const shadowTokens: { name: string; variable: string }[] = [
  { name: "xs", variable: "--ds-shadow-xs" },
  { name: "sm", variable: "--ds-shadow-sm" },
  { name: "md", variable: "--ds-shadow-md" },
  { name: "lg", variable: "--ds-shadow-lg" },
  { name: "xl", variable: "--ds-shadow-xl" },
  { name: "2xl", variable: "--ds-shadow-2xl" },
];

/* ---------------------------------------------------------------------------
 * Story: AllShadows
 * ------------------------------------------------------------------------- */

function AllShadows() {
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
          Shadow Scale
        </h2>
        <p
          style={{
            fontSize: "var(--ds-font-size-sm)",
            color: "var(--muted-foreground)",
            marginBottom: 24,
          }}
        >
          Elevation levels using OKLCH shadow colors for natural blending.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 32,
          }}
        >
          {shadowTokens.map((token) => (
            <div
              key={token.variable}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
              }}
            >
              {/* Shadow card */}
              <div
                style={{
                  width: "100%",
                  height: 120,
                  borderRadius: 8,
                  backgroundColor: "var(--card)",
                  boxShadow: `var(${token.variable})`,
                  border: "1px solid var(--border)",
                }}
              />

              {/* Label */}
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "var(--ds-font-size-sm)",
                    fontWeight:
                      "var(--ds-font-weight-semibold)" as unknown as number,
                  }}
                >
                  {token.name}
                </div>
                <div
                  style={{
                    fontSize: "var(--ds-font-size-xs)",
                    color: "var(--muted-foreground)",
                    fontFamily: "monospace",
                  }}
                >
                  var({token.variable})
                </div>
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
  title: "Foundations/Shadows",
};

export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => <AllShadows />,
};
