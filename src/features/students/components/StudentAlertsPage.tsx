import { Bell, AlertTriangle, Info, CheckCircle2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export const StudentAlertsPage = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Academic Alerts & Notifications
          </h1>
          <p className="text-sm text-slate-600">
            Automated alerts, attendance warnings, and academic advisor interventions.
          </p>
        </div>
        <Button variant="outline" size="sm" className="bg-white text-xs">
          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-slate-500" />
          Mark all as read
        </Button>
      </div>

      <div className="space-y-4">
        {/* Alert 1 */}
        <Card className="border-l-4 border-l-rose-500 border-slate-200 bg-white shadow-xs">
          <CardContent className="p-5 flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-900">
                  Critical Warning: Low Pass Probability in CS102
                </p>
                <Badge variant="destructive" className="text-[10px]">High Priority</Badge>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Your mid-term evaluation indicates a pass probability of 45%. We strongly recommend scheduling an office-hour session with Prof. John Doe or testing scenarios on the What-If Simulator.
              </p>
              <div className="flex items-center gap-4 mt-3 text-[11px] text-slate-400">
                <span>Yesterday at 14:20</span>
                <span>•</span>
                <span className="text-rose-600 font-semibold cursor-pointer hover:underline">
                  View Recommended Action Plan
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alert 2 */}
        <Card className="border-l-4 border-l-amber-500 border-slate-200 bg-white shadow-xs">
          <CardContent className="p-5 flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Bell className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-900">
                  Upcoming Assignment Deadline: MATH201 Problem Set #4
                </p>
                <Badge className="bg-amber-100 text-amber-800 text-[10px]">Due in 2 days</Badge>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Linear Algebra homework submission portal closes this Friday at 23:59. Timely completion will help bolster your continuous assessment score.
              </p>
              <div className="flex items-center gap-4 mt-3 text-[11px] text-slate-400">
                <span>Oct 15, 2026</span>
                <span>•</span>
                <span className="text-amber-700 font-semibold cursor-pointer hover:underline">
                  Submit via LMS
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alert 3 */}
        <Card className="border-l-4 border-l-blue-500 border-slate-200 bg-white shadow-xs">
          <CardContent className="p-5 flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Info className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-900">
                  Degree Audit Milestone: 112 Credits Reached
                </p>
                <Badge variant="outline" className="text-blue-700 border-blue-200 bg-blue-50 text-[10px]">Milestone</Badge>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Congratulations on crossing 112 completed credits. Please meet with your academic advisor before registration opens for the Fall 2025 semester.
              </p>
              <div className="flex items-center gap-4 mt-3 text-[11px] text-slate-400">
                <span>Oct 10, 2026</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
