import type { Meta, StoryObj } from "@storybook/react";
import React from "react";

/* ---------------------------------------------------------------------------
 * Data
 * ------------------------------------------------------------------------- */

const semanticColors = [
  { name: "background", variable: "--background" },
  { name: "foreground", variable: "--foreground" },
  { name: "card", variable: "--card" },
  { name: "card-foreground", variable: "--card-foreground" },
  { name: "popover", variable: "--popover" },
  { name: "popover-foreground", variable: "--popover-foreground" },
  { name: "primary", variable: "--primary" },
  { name: "primary-foreground", variable: "--primary-foreground" },
  { name: "secondary", variable: "--secondary" },
  { name: "secondary-foreground", variable: "--secondary-foreground" },
  { name: "muted", variable: "--muted" },
  { name: "muted-foreground", variable: "--muted-foreground" },
  { name: "accent", variable: "--accent" },
  { name: "accent-foreground", variable: "--accent-foreground" },
  { name: "destructive", variable: "--destructive" },
  { name: "border", variable: "--border" },
  { name: "input", variable: "--input" },
  { name: "ring", variable: "--ring" },
  { name: "success", variable: "--success" },
  { name: "success-foreground", variable: "--success-foreground" },
  { name: "warning", variable: "--warning" },
  { name: "warning-foreground", variable: "--warning-foreground" },
  { name: "info", variable: "--info" },
  { name: "info-foreground", variable: "--info-foreground" },
  { name: "error", variable: "--error" },
  { name: "error-foreground", variable: "--error-foreground" },
];

const primitiveScales: {
  name: string;
  steps: { step: string; variable: string }[];
}[] = [
  {
    name: "Brand",
    steps: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map(
      (s) => ({
        step: String(s),
        variable: `--ds-color-brand-${s}`,
      })
    ),
  },
  {
    name: "Neutral",
    steps: [0, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map(
      (s) => ({
        step: String(s),
        variable: `--ds-color-neutral-${s}`,
      })
    ),
  },
  {
    name: "Red",
    steps: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((s) => ({
      step: String(s),
      variable: `--ds-color-red-${s}`,
    })),
  },
  {
    name: "Green",
    steps: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((s) => ({
      step: String(s),
      variable: `--ds-color-green-${s}`,
    })),
  },
  {
    name: "Amber",
    steps: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((s) => ({
      step: String(s),
      variable: `--ds-color-amber-${s}`,
    })),
  },
  {
    name: "Blue",
    steps: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((s) => ({
      step: String(s),
      variable: `--ds-color-blue-${s}`,
    })),
  },
];

/* ---------------------------------------------------------------------------
 * Swatch component
 * ------------------------------------------------------------------------- */

function Swatch({
  variable,
  label,
}: {
  variable: string;
  label: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 6,
          backgroundColor: `var(${variable})`,
          border: "1px solid var(--border)",
          flexShrink: 0,
        }}
      />
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: "var(--ds-font-size-sm)",
            fontWeight: "var(--ds-font-weight-semibold)" as unknown as number,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: "var(--ds-font-size-xs)",
            color: "var(--muted-foreground)",
            fontFamily: "monospace",
          }}
        >
          var({variable})
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Story: AllColors
 * ------------------------------------------------------------------------- */

function AllColors() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
      {/* Semantic Colors */}
      <section>
        <h2
          style={{
            fontSize: "var(--ds-font-size-2xl)",
            fontWeight: "var(--ds-font-weight-bold)" as unknown as number,
            marginBottom: 24,
          }}
        >
          Semantic Colors
        </h2>
        <p
          style={{
            fontSize: "var(--ds-font-size-sm)",
            color: "var(--muted-foreground)",
            marginBottom: 24,
          }}
        >
          Purpose-driven color aliases. Use these in components instead of
          primitive tokens directly.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {semanticColors.map((c) => (
            <Swatch key={c.variable} variable={c.variable} label={c.name} />
          ))}
        </div>
      </section>

      {/* Primitive Color Scales */}
      <section>
        <h2
          style={{
            fontSize: "var(--ds-font-size-2xl)",
            fontWeight: "var(--ds-font-weight-bold)" as unknown as number,
            marginBottom: 24,
          }}
        >
          Primitive Color Scales
        </h2>
        <p
          style={{
            fontSize: "var(--ds-font-size-sm)",
            color: "var(--muted-foreground)",
            marginBottom: 24,
          }}
        >
          Raw color ramps. Reference these only through semantic tokens.
        </p>

        {primitiveScales.map((scale) => (
          <div key={scale.name} style={{ marginBottom: 32 }}>
            <h3
              style={{
                fontSize: "var(--ds-font-size-lg)",
                fontWeight:
                  "var(--ds-font-weight-semibold)" as unknown as number,
                marginBottom: 12,
              }}
            >
              {scale.name}
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: 12,
              }}
            >
              {scale.steps.map(({ step, variable }) => (
                <Swatch
                  key={variable}
                  variable={variable}
                  label={`${scale.name.toLowerCase()}-${step}`}
                />
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Meta
 * ------------------------------------------------------------------------- */

const meta: Meta = {
  title: "Foundations/Colors",
};

export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => <AllColors />,
};
