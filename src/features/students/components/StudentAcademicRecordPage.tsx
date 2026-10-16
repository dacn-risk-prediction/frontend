import { GraduationCap, Award, BookOpen, Clock } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export const StudentAcademicRecordPage = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Academic Record
          </h1>
          <p className="text-sm text-slate-600">
            Comprehensive transcript, semester-by-semester breakdown, and credit audit.
          </p>
        </div>
        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 w-fit">
          <Award className="mr-1.5 h-3.5 w-3.5" />
          Official Degree Audit
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">Degree Major</p>
              <p className="text-sm font-bold text-slate-900">Computer Science (B.S.)</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">Current Standing</p>
              <p className="text-sm font-bold text-slate-900">Senior (Year 4)</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">Expected Graduation</p>
              <p className="text-sm font-bold text-slate-900">Summer 2025</p>
            </div>
          </div>
        </div>
      </div>

      <Card className="border-slate-200 bg-white shadow-xs">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-blue-700" />
            Semester Course History
          </CardTitle>
          <CardDescription>
            Full historical registry of enrolled courses and graded competencies.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-3">Course Code</th>
                  <th className="px-4 py-3">Course Name</th>
                  <th className="px-4 py-3">Credits</th>
                  <th className="px-4 py-3">Grade</th>
                  <th className="px-4 py-3">Semester</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-mono font-semibold text-slate-900">CS102</td>
                  <td className="px-4 py-3 font-medium text-slate-800">Data Structures & Algorithms</td>
                  <td className="px-4 py-3 text-slate-600">4</td>
                  <td className="px-4 py-3 font-semibold text-amber-600">In Progress</td>
                  <td className="px-4 py-3 text-slate-500">Spring 2025</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className="text-xs">Enrolled</Badge>
                  </td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-mono font-semibold text-slate-900">CS201</td>
                  <td className="px-4 py-3 font-medium text-slate-800">Database Systems</td>
                  <td className="px-4 py-3 text-slate-600">3</td>
                  <td className="px-4 py-3 font-semibold text-emerald-600">In Progress</td>
                  <td className="px-4 py-3 text-slate-500">Spring 2025</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className="text-xs">Enrolled</Badge>
                  </td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-mono font-semibold text-slate-900">MATH201</td>
                  <td className="px-4 py-3 font-medium text-slate-800">Linear Algebra</td>
                  <td className="px-4 py-3 text-slate-600">3</td>
                  <td className="px-4 py-3 font-semibold text-amber-600">In Progress</td>
                  <td className="px-4 py-3 text-slate-500">Spring 2025</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className="text-xs">Enrolled</Badge>
                  </td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-mono font-semibold text-slate-900">CS101</td>
                  <td className="px-4 py-3 font-medium text-slate-800">Introduction to Computer Science</td>
                  <td className="px-4 py-3 text-slate-600">4</td>
                  <td className="px-4 py-3 font-bold text-emerald-700">3.8 (A)</td>
                  <td className="px-4 py-3 text-slate-500">Fall 2024</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-xs">Completed</Badge>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

