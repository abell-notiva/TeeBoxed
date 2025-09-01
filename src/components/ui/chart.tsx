
"use client"

import * as React from "react"
import * as RechartsPrimitive from "recharts"

import { cn } from "@/lib/utils"

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: "", dark: ".dark" } as const

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode
    icon?: React.ComponentType<{ className?: string }>
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  )
}

type ChartContextProps = {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />")
  }

  return context
}

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: ChartConfig
    children: React.ComponentProps<
      typeof RechartsPrimitive.ResponsiveContainer
    >["children"]
  }
>(({ id, className, children, config, ...props }, ref) => {
  const chartId = `chart-${id || React.useId()}`
  const [activeTheme] = React.useState<keyof typeof THEMES>("light")
  const chartRef = React.useRef<HTMLDivElement>(null)

  const style = React.useMemo(() => {
    return {
      "--chart-font-family": "var(--font-sans)",
      ...Object.fromEntries(
        Object.entries(config).map(([key, value]) => {
          const color = value.theme?.[activeTheme] || value.color
          return [`--color-${key}`, color]
        })
      ),
    } as React.CSSProperties
  }, [config, activeTheme])

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        ref={ref}
        style={style}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke-dasharray]]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-polar-grid_[stroke-dasharray]]:stroke-border/50 [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-radial-bar-sectors_path]:fill-primary [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_line]:stroke-border [&_.recharts-sector_path.recharts-tooltip-cursor]:fill-muted [&_.recharts-surface]:outline-none",
          className
        )}
        {...props}
      >
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
})
ChartContainer.displayName = "Chart"

const ChartTooltip = RechartsPrimitive.Tooltip

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
    React.ComponentProps<"div"> & {
      hideLabel?: boolean
      hideIndicator?: boolean
      indicator?: "line" | "dot" | "dashed"
      nameKey?: string
      labelKey?: string
    }
>(
  (
    {
      active,
      payload,
      className,
      indicator = "dot",
      hideLabel = false,
      hideIndicator = false,
      label,
      labelFormatter,
      labelClassName,
      formatter,
      color,
      nameKey,
      labelKey,
    },
    ref
  ) => {
    const { config } = useChart()

    const tooltipLabel = React.useMemo(() => {
      if (hideLabel || !payload?.length) {
        return null
      }

      const [item] = payload
      const key = `${labelKey || item.dataKey || "value"}`
      const itemConfig = config[key]
      const value =
        !labelKey && typeof labelFormatter === "function"
          ? labelFormatter(label, payload)
          : itemConfig?.label || label

      if (itemConfig?.icon) {
        return (
          <div className="flex items-center gap-1.5">
            <itemConfig.icon className="h-4 w-4 flex-shrink-0" />
            {value}
          </div>
        )
      }

      return value
    }, [label, payload, hideLabel, labelFormatter, labelKey, config])

    if (!active || !payload?.length) {
      return null
    }

    const nestLabel = payload.length === 1 && indicator !== "dot"

    return (
      <div
        ref={ref}
        className={cn(
          "grid min-w-[8rem] items-start gap-1.5 rounded-lg border bg-background p-2.5 text-sm shadow-xl [&>div]:flex",
          className
        )}
      >
        {!nestLabel && tooltipLabel ? (
          <div className={cn("font-medium", labelClassName)}>{tooltipLabel}</div>
        ) : null}
        <div className="grid gap-1.5">
          {payload.map((item, i) => {
            const key = `${nameKey || item.name || item.dataKey || "value"}`
            const itemConfig = config[key]
            const indicatorColor = color || item.color

            return (
              <div
                key={`item-${i}-${item.name || item.dataKey || "value"}`}
                className={cn(
                  "flex w-full items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
                  indicator === "dot" && "items-center"
                )}
              >
                {formatter && item.value && item.name ? (
                  formatter(item.value, item.name, item, i, payload)
                ) : (
                  <>
                    {!hideIndicator && (
                      <div
                        className={cn(
                          "shrink-0",
                          {
                            line: "h-2.5 w-0.5",
                            dashed: "h-2.5 w-0.5 border-[1.5px] border-dashed",
                            dot: "h-2.5 w-2.5 rounded-full",
                          }[indicator]
                        )}
                        style={{
                          background: indicatorColor,
                        }}
                      />
                    )}
                    <div
                      className={cn(
                        "flex flex-1 justify-between leading-none",
                        nestLabel && "items-end"
                      )}
                    >
                      <div className="grid gap-1.5">
                        {nestLabel ? tooltipLabel : null}
                        <span className="text-muted-foreground">
                          {itemConfig?.label || item.name}
                        </span>
                      </div>
                      {item.value && (
                        <span className="font-mono font-medium tabular-nums text-foreground">
                          {item.value.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }
)
ChartTooltipContent.displayName = "ChartTooltip"

const ChartLegend = RechartsPrimitive.Legend

const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> &
    Pick<RechartsPrimitive.LegendProps, "payload" | "verticalAlign"> & {
      hideIcon?: boolean
      nameKey?: string
    }
>(
  ({ className, hideIcon = false, payload, verticalAlign = "bottom", nameKey }, ref) => {
    const { config } = useChart()

    if (!payload || !payload.length) {
      return null
    }

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-center gap-4",
          verticalAlign === "top" ? "pb-3" : "pt-3",
          className
        )}
      >
        {payload.map((item) => {
          const key = `${nameKey || item.dataKey || "value"}`
          const itemConfig = config[key]

          return (
            <div
              key={item.value}
              className={cn(
                "flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground"
              )}
            >
              {itemConfig?.icon && !hideIcon ? (
                <itemConfig.icon />
              ) : (
                <div
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: item.color }}
                />
              )}
              {itemConfig?.label}
            </div>
          )
        })}
      </div>
    )
  }
)
ChartLegendContent.displayName = "ChartLegend"

// Chart Primitives
const AreaChart = RechartsPrimitive.AreaChart
const Area = RechartsPrimitive.Area
const BarChart = RechartsPrimitive.BarChart
const Bar = RechartsPrimitive.Bar
const LineChart = RechartsPrimitive.LineChart
const Line = RechartsPrimitive.Line
const PieChart = RechartsPrimitive.PieChart
const Pie = RechartsPrimitive.Pie
const Cell = RechartsPrimitive.Cell
const RadarChart = RechartsPrimitive.RadarChart
const Radar = RechartsPrimitive.Radar
const RadialBarChart = RechartsPrimitive.RadialBarChart
const RadialBar = RechartsPrimitive.RadialBar
const ChartGrid = RechartsPrimitive.CartesianGrid
const ChartXAxis = RechartsPrimitive.XAxis
const ChartYAxis = RechartsPrimitive.YAxis
const ChartPolarGrid = RechartsPrimitive.PolarGrid
const ChartPolarAngleAxis = RechartsPrimitive.PolarAngleAxis
const ChartPolarRadiusAxis = RechartsPrimitive.PolarRadiusAxis
const ChartReferenceLine = RechartsPrimitive.ReferenceLine

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartGrid,
  ChartXAxis,
  ChartYAxis,
  ChartPolarGrid,
  ChartPolarAngleAxis,
  ChartPolarRadiusAxis,
  ChartReferenceLine,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  RadialBarChart,
  RadialBar,
}