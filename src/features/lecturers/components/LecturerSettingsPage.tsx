import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthUser } from "@/features/auth";
import {
  Building,
  CheckCircle2,
  Mail,
  Shield,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLecturerDetail } from "../api/lecturer-api";

export const LecturerSettingsPage = () => {
  const { data: user } = useAuthUser();
  const lecturerId = user?.user_code || user?.id;
  const { data: lecturerDetail } = useLecturerDetail(lecturerId);
  const [isSaved, setIsSaved] = useState(false);

  const lecturerName = user?.name || "Dr. Faculty Lecturer";
  const lecturerEmail = user?.email || "lecturer@hcmut.edu.vn";
  const lecturerCode = user?.user_code || lecturerId || "LEC1001";
  const department =
    lecturerDetail?.departments || user?.title || "Computer Science & Engineering";

  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    toast.success("Faculty settings updated successfully");
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Faculty Settings
          </h1>
          <Badge className="bg-blue-600 text-white font-medium">
            Profile & Security
          </Badge>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Manage your faculty profile information, office hours, and notification preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Profile Card */}
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-900">
              Faculty Profile
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Institutional identity & credentials
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center text-center">
            <Avatar className="h-20 w-20 border-2 border-blue-200 ring-4 ring-blue-50">
              <AvatarImage src={user?.avatar_url} alt={lecturerName} />
              <AvatarFallback className="bg-blue-700 text-lg font-bold text-white">
                {getInitials(lecturerName)}
              </AvatarFallback>
            </Avatar>

            <h3 className="mt-4 text-base font-bold text-slate-900">
              {lecturerName}
            </h3>
            <p className="text-xs text-slate-500">{lecturerEmail}</p>

            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              <Badge
                variant="outline"
                className="border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold"
              >
                Faculty ID: {lecturerCode}
              </Badge>
              <Badge className="bg-slate-900 text-white text-xs">
                Active Staff
              </Badge>
            </div>

            <div className="mt-6 w-full space-y-3 border-t border-slate-100 pt-5 text-left text-xs">
              <div className="flex items-center gap-2 text-slate-600">
                <Building className="h-4 w-4 text-slate-400" />
                <span>{department}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Shield className="h-4 w-4 text-slate-400" />
                <span>Role: Lecturer / Academic Evaluator</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Mail className="h-4 w-4 text-slate-400" />
                <span>Institutional Email Verified</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Settings Form */}
        <Card className="border-slate-200 bg-white shadow-xs lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-900">
              General Information & Preferences
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Update contact info and advising office hours
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="fullname" className="text-xs font-medium text-slate-700">
                    Full Name
                  </Label>
                  <Input
                    id="fullname"
                    defaultValue={lecturerName}
                    className="text-xs bg-slate-50/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-medium text-slate-700">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    defaultValue={lecturerEmail}
                    disabled
                    className="text-xs bg-slate-100 cursor-not-allowed text-slate-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="office" className="text-xs font-medium text-slate-700">
                    Faculty Office Location
                  </Label>
                  <Input
                    id="office"
                    defaultValue="Room 402, Building A4, Ly Thuong Kiet Campus"
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hours" className="text-xs font-medium text-slate-700">
                    Office Advising Hours
                  </Label>
                  <Input
                    id="hours"
                    defaultValue="Tuesday & Thursday: 14:00 - 16:30"
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <Label className="text-xs font-medium text-slate-700">
                  Notification Thresholds
                </Label>
                <div className="rounded-lg border border-slate-200 p-3.5 space-y-2.5 text-xs text-slate-600">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded border-slate-300 text-blue-600" />
                    <span>Send email alert when a student's predicted risk score exceeds 65%</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded border-slate-300 text-blue-600" />
                    <span>Daily summary digest of unresolved class interventions</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded border-slate-300 text-blue-600" />
                    <span>Notification on prerequisite waiver requests</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="submit"
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs cursor-pointer"
                >
                  {isSaved ? (
                    <>
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                      Saved
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
