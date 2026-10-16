import { User, Bell, Shield, Lock } from "lucide-react"
import { useAuthUser } from "@/features/auth"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export const StudentSettingsPage = () => {
  const { data: user } = useAuthUser()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Account Settings
        </h1>
        <p className="text-sm text-slate-600">
          Manage your student profile, academic preferences, and alert notifications.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Profile Card */}
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5 text-blue-700" />
                Personal Information
              </CardTitle>
              <CardDescription>
                Synchronized with the institutional student information system (SIS).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Full Name</label>
                  <p className="mt-1 font-medium text-slate-900 text-sm">
                    {user?.name || "Nguyễn Văn A"}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Student Code</label>
                  <p className="mt-1 font-mono font-medium text-slate-900 text-sm">
                    {user?.user_code || "2011928"}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">University Email</label>
                  <p className="mt-1 font-medium text-slate-900 text-sm">
                    {user?.email || "phamquocanh.2698615@hcmut.edu.vn"}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">System Role</label>
                  <p className="mt-1 font-medium text-slate-900 text-sm capitalize">
                    {user?.role || "student"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notifications Card */}
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell className="h-5 w-5 text-blue-700" />
                Alert Preferences
              </CardTitle>
              <CardDescription>
                Choose how and when Aurora delivers academic risk alerts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-center justify-between rounded-lg border border-slate-100 p-3 hover:bg-slate-50 cursor-pointer">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Immediate Risk Escalation</p>
                  <p className="text-xs text-slate-500">Notify when course pass probability drops below 50%</p>
                </div>
                <input type="checkbox" defaultChecked className="h-4 w-4 accent-blue-700" />
              </label>

              <label className="flex items-center justify-between rounded-lg border border-slate-100 p-3 hover:bg-slate-50 cursor-pointer">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Weekly Academic Health Digest</p>
                  <p className="text-xs text-slate-500">Summary of GPA trend and upcoming milestone targets</p>
                </div>
                <input type="checkbox" defaultChecked className="h-4 w-4 accent-blue-700" />
              </label>
            </CardContent>
          </Card>
        </div>

        {/* Security & Access */}
        <div className="space-y-6">
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-5 w-5 text-blue-700" />
                Security & Session
              </CardTitle>
              <CardDescription>Institutional authentication credentials</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-200/60">
                <p className="text-xs font-semibold text-slate-800">HCMUT SSO Connected</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Password management is delegated to Central Authentication Service.
                </p>
              </div>

              <Button variant="outline" className="w-full text-xs" size="sm">
                <Lock className="mr-1.5 h-3.5 w-3.5" />
                Manage SSO Credentials
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

