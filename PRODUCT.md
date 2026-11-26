# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Hệ thống phục vụ đồng thời ba nhóm người dùng trong môi trường đại học với mức ưu tiên cân bằng:

1. **Sinh viên:** Theo dõi tiến độ học tập, kiểm tra 3 trụ cột tốt nghiệp (Học vụ, Chuẩn Ngoại ngữ, Ngày CTXH), xem bảng điểm, thử nghiệm kịch bản điểm (*What-if* / *XAI Simulation*) và trao đổi trực tiếp với cố vấn học vụ.
2. **Giảng viên / Cố vấn học vụ:** Quản lý danh sách lớp phụ trách, phát hiện sớm sinh viên có nguy cơ rớt môn hoặc tụt tiến độ qua phân tích XAI, và thực hiện cảnh báo / can thiệp kịp thời.
3. **Quản trị viên (Admin):** Quản trị người dùng, học kỳ đang hoạt động và dữ liệu học vụ nền tảng cho toàn hệ thống.

## Product Purpose

Cung cấp một cổng thông tin học vụ và cố vấn học tập minh bạch, kết nối dữ liệu kết quả học tập thực tế với các mô hình dự báo **Explainable AI (XAI)** và cơ chế gợi ý hành động khả thi (*counterfactual recourse*). Thành công của sản phẩm là giúp sinh viên và giảng viên nắm bắt đúng vấn đề học vụ, tự tin ra quyết định cải thiện kết quả mà không bị choáng ngợp bởi số liệu rời rạc.

## Positioning

Khác với các cổng đào tạo truyền thống chỉ hiển thị bảng điểm tĩnh, hệ thống kết hợp **theo dõi điều kiện tốt nghiệp theo thời gian thực** với **dự báo rủi ro và gợi ý cải thiện điểm số có giải thích minh bạch (XAI + Counterfactual)**, đồng thời nối liền trực tiếp với luồng trao đổi can thiệp giữa giảng viên và sinh viên.

## Operating Context

- **Bối cảnh sử dụng:** Web application dạng dashboard đa vai trò (`/student/*`, `/lecturer/*`, `/admin/*`), tối ưu cho thao tác làm việc chính trên máy tính (desktop) và hiển thị đầy đủ trên tablet/mobile.
- **Quy chế học vụ tham chiếu:** Chuẩn đào tạo tín chỉ (mốc 128 tín chỉ tích lũy, GPA ≥ 2.00, chuẩn Ngoại ngữ đầu ra, và mốc ngày Công tác xã hội: 12 ngày đủ điều kiện làm KLTN, 15 ngày đủ điều kiện tốt nghiệp).
- **Quy trình cốt lõi:** Sinh viên đăng nhập xem tổng quan học vụ → khoan sâu vào từng môn hoặc kịch bản mô phỏng điểm → liên hệ cố vấn khi cần; Giảng viên xem cảnh báo lớp học → gửi khuyến nghị can thiệp cho sinh viên; Admin thiết lập học kỳ và tài khoản.

## Capabilities and Constraints

- **Minh bạch AI (XAI Integrity):** Các khối dự báo, giải thích yếu tố ảnh hưởng và gợi ý counterfactual chỉ được trình bày trên dữ liệu thật từ API; không tự bịa điểm số, không che giấu độ bất định và không thay thế quyết định chuyên môn của cố vấn học vụ.
- **Tối giản thông tin theo ngữ cảnh (Progressive Disclosure):** Mỗi màn hình chỉ giữ mật độ thông tin vừa đủ để người dùng quét nhanh; tổ chức điều hướng rõ ràng theo từng phần/tab hoặc hành động bấm-mới-hiện để người dùng chủ động đi tới đúng thông tin cần tìm.
- **Phạm vi dữ liệu hiện tại:** Sử dụng dữ liệu học vụ và xác thực qua API backend nội bộ của dự án (`src/features/*/api/*`); chưa triển khai SSO trường học hay cổng thanh toán/đăng ký môn trực tiếp.

## Brand Commitments

- **Ngôn ngữ & giọng điệu:** Tiếng Việt thống nhất trên toàn bộ giao diện và thông báo UX, giữ nguyên các thuật ngữ chuyên ngành đã quen thuộc trong môi trường đại học và XAI (`GPA`, `TC`, `CTXH`, `KLTN`, `XAI`). Giọng điệu rõ ràng, khách quan, mang tính hỗ trợ học thuật.
- **Trải nghiệm web thực thụ:** Giao diện phải cho cảm giác một ứng dụng web hoàn chỉnh, mạch lạc khi chuyển trang, hạn chế chữ thừa và tránh nhồi nhét mọi thứ vào một màn hình đơn lẻ.

## Evidence on Hand

- Mã nguồn ứng dụng web React + Vite đã vận hành tại [src/app/router.tsx](src/app/router.tsx) với đầy đủ các phân hệ cho `student`, `lecturer`, và `admin`.
- Đặc tả API và các luồng nghiệp vụ counterfactual / lời khuyên sư phạm nằm trong cấu hình dự án và các module `src/features/*`.
- Chưa có chứng thực khách hàng thương mại hay số liệu benchmark ngoài phạm vi dự án; không tự tạo dữ liệu minh họa giả mạo ngoài dữ liệu API/trạng thái trống trung thực.

## Product Principles

1. **Ít nhưng đúng (Distill First):** Không nhồi nhét toàn bộ dữ liệu vào một màn hình; chia lớp thông tin theo nhu cầu tra cứu để người dùng chọn đúng phần cần xem.
2. **Giải thích đi kèm hành động:** Mọi cảnh báo rủi ro hay dự báo XAI đều phải gắn với lý do dễ hiểu và bước hành động cụ thể sinh viên/giảng viên có thể làm ngay.
3. **Ngôn ngữ nhất quán, không pha tạp:** Thống nhất tiếng Việt rõ ràng trong nhãn, nút bấm và thông báo lỗi; chỉ dùng thuật ngữ viết tắt chuẩn ngành khi cần thiết.
4. **Trung thực với trạng thái dữ liệu:** Hiển thị rõ ràng khi dữ liệu đang tải, trống, hoặc lỗi kèm nút thử lại; tuyệt đối không suy diễn hoặc bịa số liệu thay API.
5. **Làm việc nhanh trên desktop, linh hoạt trên di động:** Đảm bảo các bảng, biểu đồ và luồng mô phỏng thao tác gọn trên màn hình rộng nhưng vẫn đọc và chạm tốt trên màn hình nhỏ.

## Accessibility & Inclusion

- Hỗ trợ làm việc chính trên màn hình desktop lẫn responsive trên tablet/mobile.
- Đảm bảo độ tương phản chữ đọc rõ ràng trên cả nền sáng và thẻ tối màu, trạng thái lỗi/cảnh báo có kèm nhãn văn bản hoặc biểu tượng chứ không chỉ dựa vào màu sắc.
