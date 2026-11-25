import { z } from "zod";

export const userCreateSchema = z.object({
  user_code: z
    .string()
    .trim()
    .min(2, "Mã tài khoản cần ít nhất 2 ký tự")
    .max(50, "Mã tài khoản tối đa 50 ký tự"),
  name: z
    .string()
    .trim()
    .min(2, "Họ tên cần ít nhất 2 ký tự")
    .max(100, "Họ tên tối đa 100 ký tự"),
  email: z.string().trim().email("Email không hợp lệ"),
  role: z.enum(["student", "lecturer", "admin"]),
  title: z.string().trim().max(100).optional(),
  department: z.string().trim().max(100).optional(),
  cohort: z.string().trim().max(20).optional(),
  major: z.string().trim().max(100).optional(),
  password: z
    .string()
    .min(6, "Mật khẩu cần tối thiểu 6 ký tự")
    .max(72, "Mật khẩu tối đa 72 ký tự"),
});

export type UserCreateFormValues = z.infer<typeof userCreateSchema>;

export const userEditSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Họ tên cần ít nhất 2 ký tự")
    .max(100, "Họ tên tối đa 100 ký tự"),
  email: z.string().trim().email("Email không hợp lệ"),
  role: z.enum(["student", "lecturer", "admin"]),
  title: z.string().trim().max(100).optional(),
  password: z
    .string()
    .refine(
      (val) => val.length === 0 || (val.length >= 6 && val.length <= 72),
      "Nếu đổi mật khẩu, cần từ 6 đến 72 ký tự",
    )
    .optional(),
});

export type UserEditFormValues = z.infer<typeof userEditSchema>;

export const semesterFormSchema = z.object({
  semester_code: z
    .string()
    .trim()
    .min(3, "Mã học kỳ tối thiểu 3 ký tự (vd: HK262)")
    .max(20, "Mã học kỳ tối đa 20 ký tự"),
  academic_year: z
    .string()
    .trim()
    .min(4, "Năm học không hợp lệ (vd: 2026-2027)")
    .max(20),
  term: z.number().int().min(1, "Học kỳ từ 1 đến 4").max(4, "Học kỳ từ 1 đến 4"),
  is_active: z.boolean(),
  withdraw_deadline: z.string().optional(),
});

export type SemesterFormValues = z.infer<typeof semesterFormSchema>;

export const courseFormSchema = z.object({
  course_code: z
    .string()
    .trim()
    .min(3, "Mã môn học tối thiểu 3 ký tự (vd: CO3041)")
    .max(20),
  course_name: z
    .string()
    .trim()
    .min(2, "Tên môn học tối thiểu 2 ký tự")
    .max(255),
  credits: z.number().int().min(0, "Số tín chỉ >= 0").max(20, "Số tín chỉ <= 20"),
});

export type CourseFormValues = z.infer<typeof courseFormSchema>;

export const classFormSchema = z.object({
  class_id: z
    .string()
    .trim()
    .min(3, "Mã lớp tối thiểu 3 ký tự (vd: HK261_CO3041_L01)")
    .max(50),
  class_group: z.string().trim().min(1, "Nhóm lớp bắt buộc (vd: L01)").max(20),
  course_code: z.string().trim().min(1, "Chọn mã môn học").max(20),
  semester_code: z.string().trim().min(1, "Chọn học kỳ").max(20),
  lecturer_id: z.string().trim().max(50).optional(),
});

export type ClassFormValues = z.infer<typeof classFormSchema>;
