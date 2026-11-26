---
name: Academic Advising & XAI Portal
description: Sổ cái học thuật hiện đại — hệ thống theo dõi tiến độ, cảnh báo sớm và giải thích dự báo XAI đa vai trò.
colors:
  aurora-blue: "#1488db"
  aurora-blue-hover: "#1176be"
  deep-academic-navy: "#030391"
  sky-tint: "#eef5fc"
  slate-canvas: "#f8fafc"
  surface-white: "#ffffff"
  surface-muted: "#f1f5f9"
  obsidian-kpi: "#0f172a"
  ink-primary: "#090e1a"
  ink-muted: "#64748b"
  border-hairline: "#e2e8f0"
  input-stroke: "#cbd5e1"
  destructive-red: "#ef4444"
  emerald-pass: "#10b981"
  amber-warn: "#f59e0b"
typography:
  display:
    fontFamily: "'Geist Variable', sans-serif"
    fontSize: "1.875rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "'Geist Variable', sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title:
    fontFamily: "'Geist Variable', sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.375
    letterSpacing: "-0.01em"
  body:
    fontFamily: "'Geist Variable', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  label:
    fontFamily: "'Geist Variable', sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: "0.025em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.aurora-blue}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.aurora-blue-hover}"
  button-outline:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
    height: "32px"
  card-surface:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.xl}"
    padding: "20px"
  card-kpi-dark:
    backgroundColor: "{colors.obsidian-kpi}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.xl}"
    padding: "20px"
  input-field:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.md}"
    padding: "4px 10px"
    height: "32px"
  badge-outline:
    backgroundColor: "{colors.sky-tint}"
    textColor: "{colors.deep-academic-navy}"
    rounded: "{rounded.xl}"
    padding: "2px 8px"
    height: "20px"
---

# Design System: Academic Advising & XAI Portal

## Overview

**Creative North Star: "The Academic Ledger"**

Hệ thống áp dụng ngôn ngữ thị giác gọn gàng, chuẩn xác và đáng tin cậy như một sổ cái học thuật số hóa. Mọi quyết định về khoảng cách, tương phản và màu sắc đều phục vụ mục tiêu giúp sinh viên, giảng viên và quản trị viên quét nhanh số liệu học vụ, nhận diện rủi ro tức thì và điều hướng sâu vào từng tác vụ mà không bị choáng ngợp.

Nền tảng sử dụng bố cục phẳng phân tầng bằng viền mảnh 1px trên nền sáng dịu (`#f8fafc`), kết hợp với các thẻ chỉ số trọng tâm nền tối (`#0f172a`) để neo thị giác ngay ở đầu trang. Các hiệu ứng trang trí dư thừa như dải gradient cầu vồng, vòng tròn blur nền hay thẻ lồng trong thẻ bị loại bỏ hoàn toàn để giữ độ sắc nét của dữ liệu.

**Key Characteristics:**
- Bề mặt phẳng, phân cấp chủ yếu bằng đường viền mảnh 1px và độ tương phản sáng/tối rõ rệt.
- Mật độ thông tin vừa phải, ưu tiên điều hướng từng phần (*progressive disclosure*) thay vì dồn toàn bộ chi tiết lên một màn hình.
- Số liệu học vụ luôn căn thẳng cột (`tabular-nums`) và dùng tiếng Việt thống nhất, giữ nguyên thuật ngữ chuẩn ngành (`GPA`, `TC`, `CTXH`, `KLTN`, `XAI`).

## Colors

Bảng màu kết hợp sắc xanh học thuật đặc trưng của nhà trường trên nền trung tính lạnh, đảm bảo độ tương phản cao cho cả thẻ số liệu tối màu lẫn bảng biểu nền sáng.

### Primary
- **Aurora Blue** (`#1488db`): Màu hành động chính cho nút CTA, thanh tiến trình chính, đường xu hướng biểu đồ GPA và vòng focus; chuyển sang **Aurora Blue Hover** (`#1176be`) khi di chuột.

### Secondary
- **Deep Academic Navy** (`#030391`): Dùng cho nhãn mục đang chọn trên thanh điều hướng phụ, chữ nhấn trên nền **Sky Tint** (`#eef5fc`), và đường phụ trợ trong biểu đồ.

### Neutral
- **Slate Canvas** (`#f8fafc`): Nền tổng thể của ứng dụng và thanh sidebar, giúp tách nhẹ các bề mặt nội dung màu trắng.
- **Surface White** (`#ffffff`): Nền chính của thẻ nội dung, bảng dữ liệu và popover.
- **Surface Muted** (`#f1f5f9`): Nền phụ cho thanh tiến trình nền, skeleton loading và trạng thái hover nhẹ.
- **Obsidian KPI** (`#0f172a`): Nền tối dành riêng cho hàng thẻ chỉ số tổng quan đầu trang, tạo neo thị giác tương phản cao với chữ trắng.
- **Ink Primary** (`#090e1a`) & **Ink Muted** (`#64748b`): Màu chữ nội dung chính và nhãn mô tả thứ cấp.
- **Border Hairline** (`#e2e8f0`) & **Input Stroke** (`#cbd5e1`): Đường viền phân tách vùng nội dung và viền ô nhập liệu.

### Semantic
- **Emerald Pass** (`#10b981`): Trạng thái đạt chuẩn học vụ, tốt nghiệp hoặc xu hướng GPA tăng.
- **Amber Warn** (`#f59e0b`): Trạng thái cần lưu ý (chưa nộp ngoại ngữ, học lại, cận mốc CTXH).
- **Destructive Red** (`#ef4444`): Cảnh báo rủi ro cao, lỗi tải dữ liệu hoặc hành động xóa.

### Named Rules
**The Anchor Contrast Rule.** Nền tối **Obsidian KPI** chỉ dùng cho các thẻ chỉ số tổng quan trọng tâm ở tầng trên cùng; chữ phụ trên nền tối phải giữ độ sáng từ `slate-300` trở lên để đảm bảo tỷ lệ tương phản ≥ 4.5:1.

**The Single Signal Rule.** Màu sắc ngữ nghĩa (xanh lá, vàng hổ phách, đỏ) luôn đi kèm nhãn văn bản hoặc biểu tượng minh họa; không dùng màu đơn lẻ làm tín hiệu duy nhất.

## Typography

**Display & Body Font:** `'Geist Variable', sans-serif` (fallback `sans-serif`)
**Mono Font:** Hệ thống monospace mặc định cho mã môn học, mã học kỳ và số liệu cố định cột.

**Character:** Sạch sẽ, hiện đại, khoảng mở rộng giúp đọc bảng điểm tiếng Việt dấu thanh phức tạp và số liệu GPA/tín chỉ rõ ràng ở mọi kích thước.

### Hierarchy
- **Display** (`800`, `1.875rem` / `30px`, line-height `1.2`): Tiêu đề trang và giá trị KPI lớn trong thẻ đầu trang.
- **Headline** (`700`, `1.5rem` / `24px`, line-height `1.25`): Tiêu đề chính các trang chức năng trên màn hình nhỏ hoặc phân vùng chính.
- **Title** (`700`, `1rem` / `16px`, line-height `1.375`): Tiêu đề các thẻ nội dung (`CardTitle`) và khối biểu đồ.
- **Body** (`400`, `0.875rem` / `14px`, line-height `1.5`): Văn bản mô tả, lời khuyên sư phạm và nội dung hội thoại cố vấn (giới hạn chiều rộng đọc tối đa `65ch–75ch`).
- **Label** (`600`, `0.75rem` / `12px`, line-height `1.33`): Nhãn cột, badge trạng thái và tiêu đề phụ viết hoa nhẹ (`tracking-wide`).

### Named Rules
**The Tabular Numerals Rule.** Mọi giá trị GPA, số tín chỉ, phần trăm hoàn thành và ngày CTXH bắt buộc áp dụng `tabular-nums` để không bị xê dịch chiều ngang khi cập nhật dữ liệu.

## Layout

Giao diện tổ chức theo mô hình ứng dụng desktop sidebar cố định bên trái kết hợp vùng nội dung chính cuộn dọc (`space-y-6`), tự động thu gọn thành menu ngăn kéo trên màn hình nhỏ (`< 768px`). Các khối chức năng sắp xếp theo lưới CSS Responsive 1 cột trên mobile và 2–3 cột trên tablet/desktop (`md:grid-cols-3`, `lg:grid-cols-3` với vùng biểu đồ chiếm 2/3 chiều rộng). Khoảng đệm bên trong thẻ duy trì ổn định ở mức `16px–20px` (`--card-spacing`), khoảng cách giữa các nhóm khối lớn là `24px`.

## Elevation & Depth

Hệ thống đi theo hướng **phẳng và phân tầng bằng viền mảnh** (*Flat & Hairline-layered*). Các bề mặt phân biệt với nền thông qua đường viền 1px (`#e2e8f0`) hoặc vòng ring mảnh (`ring-foreground/10`) kết hợp chênh lệch sắc độ nền (`#f8fafc` so với `#ffffff`), hạn chế tối đa bóng đổ nặng.

### Shadow Vocabulary
- **Subtle Resting** (`box-shadow: 0 1px 2px rgba(9, 14, 26, 0.04)`): Bóng cực nhẹ (`shadow-xs` / `shadow-2xs`) cho thẻ nội dung trắng và nút viền.
- **Card Focus / Dark KPI** (`box-shadow: 0 1px 3px rgba(9, 14, 26, 0.08)`): Độ sâu nhẹ cho nhóm thẻ KPI tối màu hoặc popover nổi.

### Named Rules
**The Hairline-First Rule.** Ưu tiên đường viền 1px (`divide-y` / `divide-x`) để chia cột và danh sách bên trong một thẻ thay vì tạo nhiều thẻ con có viền và bóng lồng nhau.

## Shapes

Ngôn ngữ hình khối sử dụng góc bo tròn mềm vừa phải, nhất quán từ gốc `--radius: 0.625rem` (`10px`):
- Nút bấm và ô nhập liệu dùng bo trung bình (`8px`).
- Thẻ nội dung và khối KPI dùng bo lớn hơn (`14px`) để tạo khung chứa rõ ràng.
- Badge/chip trạng thái dùng bo tròn dạng viên nang (`9999px`) hoặc bo nhỏ (`6px`) cho mã học kỳ nội tuyến.

## Components

Thành phần giao diện giữ phong cách tinh gọn, có phản hồi trạng thái rõ ràng khi di chuột và điều hướng bàn phím.

### Buttons
- **Shape:** Bo tròn trung bình (`8px`).
- **Primary:** Nền **Aurora Blue**, chữ trắng, đệm ngang `16px`, cao `36px` (`h-9`).
- **Hover / Focus:** Chuyển nền sang **Aurora Blue Hover**, hiển thị vòng focus 3px (`ring-ring/50`).
- **Secondary / Outline / Ghost:** Nút viền trắng mỏng (`1px solid #e2e8f0`) cho tác vụ phụ cấp trang; nút `ghost` chữ xanh cho liên kết hành động nhanh trong từng dòng danh sách.

### Chips
- **Style:** Nền nhạt theo ngữ nghĩa (**Sky Tint** cho thông tin, nền xanh lá/vàng nhạt cho trạng thái), viền 1px cùng tông, chữ `11px–12px` đậm vừa.
- **State:** Chỉ gắn badge khi mang ý nghĩa trạng thái cần chú ý (ví dụ: *Học lại*, *Đạt chuẩn*, *Đủ ĐK KLTN*); thông tin phụ tĩnh như số tín chỉ hay tên nhóm gộp thành chữ phân tách bằng dấu `·`.

### Cards / Containers
- **Corner Style:** Bo lớn (`14px` / `rounded-xl`).
- **Background:** **Surface White** cho card thường; **Obsidian KPI** cho bộ thẻ chỉ số đầu trang.
- **Shadow Strategy:** Phẳng với viền 1px và `shadow-xs`.
- **Internal Padding:** Đệm đều `20px` cho vùng header/nội dung, hoặc `p-0` kết hợp `divide-y` khi chứa danh sách cuộn.

### Inputs / Fields
- **Style:** Cao `32px` (`h-8`), nền trắng, viền `1px solid #cbd5e1`, bo `8px`.
- **Focus:** Viền chuyển sang **Aurora Blue** kèm vòng ring 3px mờ (`ring-ring/50`).
- **Error / Disabled:** Viền **Destructive Red** khi `aria-invalid`; giảm opacity 50% và đổi nền nhạt khi `disabled`.

### Navigation
- Thanh điều hướng dọc bên trái trên desktop (có thể thu gọn), nền **Slate Canvas**, mục đang chọn tô nền **Sky Tint** với chữ **Deep Academic Navy** đậm; hiển thị badge số lượng thông báo chưa đọc trên mục *Cố vấn & Hướng dẫn*.

## Do's and Don'ts

### Do:
- **Do** dùng một thẻ lớn chia cột bằng `divide-x` / `divide-y` khi trình bày nhiều trụ cột hoặc danh sách dòng liên quan.
- **Do** cung cấp đủ 4 trạng thái cho mọi khối dữ liệu API: đang tải (`Skeleton`), trống, lỗi kèm nút thử lại, và có dữ liệu.
- **Do** giữ ngôn ngữ nút bấm theo cấu trúc *Động từ + Đối tượng* cụ thể (ví dụ: *Mở Trình Dự báo*, *Xem khung CTĐT*).

### Don't:
- **Don't** lồng thẻ có viền và nền riêng vào bên trong một thẻ khác (*nested cards*).
- **Don't** dùng dải gradient nhiều màu, vòng tròn ánh sáng blur trang trí hoặc lặp lại khung vuông bọc icon ở mọi dòng.
- **Don't** gắn quá 1–2 badge trên cùng một hàng danh sách (*status-chip soup*) hay pha trộn nhãn tiếng Anh và tiếng Việt trên cùng màn hình.
