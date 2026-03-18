import type { Meta, StoryObj } from "@storybook/react";
import React from "react";

/* ---------------------------------------------------------------------------
 * Data
 * ------------------------------------------------------------------------- */

const fontSizes: { name: string; variable: string; px: string }[] = [
  { name: "xs", variable: "--ds-font-size-xs", px: "12px" },
  { name: "sm", variable: "--ds-font-size-sm", px: "14px" },
  { name: "md", variable: "--ds-font-size-md", px: "16px" },
  { name: "lg", variable: "--ds-font-size-lg", px: "18px" },
  { name: "xl", variable: "--ds-font-size-xl", px: "20px" },
  { name: "2xl", variable: "--ds-font-size-2xl", px: "24px" },
  { name: "3xl", variable: "--ds-font-size-3xl", px: "30px" },
  { name: "4xl", variable: "--ds-font-size-4xl", px: "36px" },
];

const fontWeights: { name: string; variable: string; value: number }[] = [
  { name: "normal", variable: "--ds-font-weight-normal", value: 400 },
  { name: "medium", variable: "--ds-font-weight-medium", value: 500 },
  { name: "semibold", variable: "--ds-font-weight-semibold", value: 600 },
  { name: "bold", variable: "--ds-font-weight-bold", value: 700 },
];

const lineHeights: { name: string; variable: string; value: string }[] = [
  { name: "tight", variable: "--ds-line-height-tight", value: "1.25" },
  { name: "normal", variable: "--ds-line-height-normal", value: "1.5" },
  { name: "loose", variable: "--ds-line-height-loose", value: "1.75" },
];

const sampleText = "The quick brown fox jumps over the lazy dog";

/* ---------------------------------------------------------------------------
 * Story: AllTypography
 * ------------------------------------------------------------------------- */

function AllTypography() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
      {/* Font Sizes */}
      <section>
        <h2
          style={{
            fontSize: "var(--ds-font-size-2xl)",
            fontWeight: "var(--ds-font-weight-bold)" as unknown as number,
            marginBottom: 24,
          }}
        >
          Font Size Scale
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {fontSizes.map((size) => (
            <div key={size.name}>
              <div
                style={{
                  fontSize: "var(--ds-font-size-xs)",
                  color: "var(--muted-foreground)",
                  fontFamily: "monospace",
                  marginBottom: 4,
                }}
              >
                {size.name} -- {size.px} -- var({size.variable})
              </div>
              <div
                style={{
                  fontSize: `var(${size.variable})`,
                  lineHeight: "var(--ds-line-height-normal)" as unknown as number,
                }}
              >
                {sampleText}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Font Weights */}
      <section>
        <h2
          style={{
            fontSize: "var(--ds-font-size-2xl)",
            fontWeight: "var(--ds-font-weight-bold)" as unknown as number,
            marginBottom: 24,
          }}
        >
          Font Weights
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {fontWeights.map((weight) => (
            <div key={weight.name}>
              <div
                style={{
                  fontSize: "var(--ds-font-size-xs)",
                  color: "var(--muted-foreground)",
                  fontFamily: "monospace",
                  marginBottom: 4,
                }}
              >
                {weight.name} -- {weight.value} -- var({weight.variable})
              </div>
              <div
                style={{
                  fontSize: "var(--ds-font-size-xl)",
                  fontWeight: `var(${weight.variable})` as unknown as number,
                  lineHeight: "var(--ds-line-height-normal)" as unknown as number,
                }}
              >
                {sampleText}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Line Heights */}
      <section>
        <h2
          style={{
            fontSize: "var(--ds-font-size-2xl)",
            fontWeight: "var(--ds-font-weight-bold)" as unknown as number,
            marginBottom: 24,
          }}
        >
          Line Heights
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {lineHeights.map((lh) => (
            <div key={lh.name}>
              <div
                style={{
                  fontSize: "var(--ds-font-size-xs)",
                  color: "var(--muted-foreground)",
                  fontFamily: "monospace",
                  marginBottom: 4,
                }}
              >
                {lh.name} -- {lh.value} -- var({lh.variable})
              </div>
              <div
                style={{
                  fontSize: "var(--ds-font-size-md)",
                  lineHeight: `var(${lh.variable})` as unknown as number,
                  maxWidth: 480,
                  padding: 12,
                  backgroundColor: "var(--muted)",
                  borderRadius: 6,
                }}
              >
                {sampleText}. {sampleText}. {sampleText}.
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
  title: "Foundations/Typography",
};

export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => <AllTypography />,
};
