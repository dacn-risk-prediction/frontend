import { useSearchParams } from "react-router-dom"
import { Sparkles, SlidersHorizontal, ArrowRight, Zap, RefreshCw } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export const StudentWhatIfPage = () => {
  const [searchParams] = useSearchParams()
  const preselectedCourse = searchParams.get("course")

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              What-If Academic Simulator
            </h1>
            <Badge className="bg-blue-600 text-white font-medium">XAI Engine</Badge>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Simulate hypothetical grades, test credit loads, and receive transparent AI risk counterfactuals.
          </p>
        </div>
      </div>

      {preselectedCourse && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-700 text-white">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-900">
                Target Simulation Focus: <span className="font-mono">{preselectedCourse}</span>
              </p>
              <p className="text-xs text-blue-700">
                AI counterfactual model loaded for this specific course. Adjust sliders below.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="bg-white text-xs text-slate-700">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Reset Parameters
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Scenario Controls */}
        <Card className="border-slate-200 bg-white shadow-xs lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <SlidersHorizontal className="h-5 w-5 text-blue-700" />
              Hypothetical Grade Inputs
            </CardTitle>
            <CardDescription>
              Adjust your target scores to see instant GPA shifts and risk probability changes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono font-bold text-slate-900 text-sm">CS102</span>
                  <span className="ml-2 text-sm text-slate-600">Data Structures</span>
                </div>
                <Badge variant="destructive" className="text-xs">Current Pass Rate: 45%</Badge>
              </div>
              <div className="mt-4 flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  defaultValue="7.5"
                  className="w-full accent-blue-700"
                />
                <span className="font-mono font-bold text-sm text-blue-700 min-w-12 text-right">
                  7.5 / 10
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono font-bold text-slate-900 text-sm">CS201</span>
                  <span className="ml-2 text-sm text-slate-600">Database Systems</span>
                </div>
                <Badge className="bg-emerald-100 text-emerald-800 text-xs">Current Pass Rate: 85%</Badge>
              </div>
              <div className="mt-4 flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  defaultValue="8.5"
                  className="w-full accent-blue-700"
                />
                <span className="font-mono font-bold text-sm text-blue-700 min-w-12 text-right">
                  8.5 / 10
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono font-bold text-slate-900 text-sm">MATH201</span>
                  <span className="ml-2 text-sm text-slate-600">Linear Algebra</span>
                </div>
                <Badge className="bg-amber-100 text-amber-800 text-xs">Current Pass Rate: 68%</Badge>
              </div>
              <div className="mt-4 flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  defaultValue="7.0"
                  className="w-full accent-blue-700"
                />
                <span className="font-mono font-bold text-sm text-blue-700 min-w-12 text-right">
                  7.0 / 10
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Projected Outcome */}
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardHeader>
            <CardTitle className="text-lg">Projected Outcome</CardTitle>
            <CardDescription>Estimated metrics with current scenario</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-xl bg-slate-900 p-5 text-white">
              <p className="text-xs uppercase tracking-wider text-slate-400 font-medium">Projected GPA</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-extrabold text-white">3.34</span>
                <span className="text-sm font-semibold text-emerald-400">+0.14 boost</span>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-700" />
                <span className="text-xs font-bold text-emerald-900 uppercase tracking-wide">
                  Risk Level Shift
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-slate-500 line-through">Moderate Risk</span>
                <ArrowRight className="h-3 w-3 text-emerald-600" />
                <span className="font-bold text-emerald-700 text-sm">Low Academic Risk</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

