<h1>🔐 Truyền file an toàn sử dụng thuật toán mã hóa AES</h1>

<p>Dự án xây dựng hệ thống web giúp người dùng <strong>mã hóa và giải mã file</strong> sử dụng thuật toán <strong>AES (Advanced Encryption Standard)</strong> nhằm đảm bảo bảo mật trong quá trình truyền tải file giữa các bên.</p>

<h2>🎯 Mục tiêu chính</h2>
<ul>
  <li>Ứng dụng thuật toán AES để đảm bảo tính bảo mật và toàn vẹn của dữ liệu.</li>
  <li>Phát triển giao diện Web thân thiện, hỗ trợ người dùng tải lên file, nhập khóa, và nhận file đã mã hóa hoặc giải mã.</li>
  <li>Hỗ trợ các định dạng như: <code>.txt</code>, <code>.docx</code>, <code>.pdf</code>, <code>.png</code>, ...</li>
</ul>

<h2>📁 Cấu trúc dự án</h2>
<ul>
  <li><code>Server.py</code>: Flask backend xử lý logic AES mã hóa và giải mã.</li>
  <li><code>client_web/static/</code>: Tệp giao diện CSS và JavaScript.</li>
  <li><code>client_web/templates/</code>: Các giao diện HTML gồm:
    <ul>
      <li><code>encrypt.html</code>: Giao diện mã hóa file</li>
      <li><code>decrypt.html</code>: Giao diện giải mã file</li>
    </ul>
  </li>
  <li><code>uploads/</code>: Thư mục lưu file đã mã hóa hoặc giải mã.</li>
  <li><code>requirements.txt</code>: Danh sách thư viện cần cài đặt</li>
</ul>

<h2>🖼️ Giao diện người dùng</h2>
<p>Người dùng có thể chọn file, nhập khóa AES và gửi yêu cầu mã hóa hoặc giải mã.</p>

<img src="Screenshot 2025-05-28 141258.png" alt="Encrypt Interface">
<br><br>
<img src="Screenshot 2025-05-28 141319.png" alt="Decrypt Interface">

<h2>🚀 Hướng dẫn chạy ứng dụng</h2>

<pre>
git clone https://github.com/TVLlam/SOCKET_AES.git
cd TES
pip install -r requirements.txt
python Server.py
</pre>

<p>Sau đó mở trình duyệt và truy cập: <code>http://127.0.0.1:5000</code></p>

<h2>🔧 Cách sử dụng</h2>
<ol>
  <li>Chọn trang <strong>"Mã hóa file"</strong></li>
  <li>Tải lên tệp muốn bảo vệ</li>
  <li>Nhập khóa AES (dài 16, 24 hoặc 32 ký tự)</li>
  <li>Nhấn "Mã hóa" để tải về file đã mã hóa</li>
  <li>Người nhận sử dụng trang "Giải mã file", tải lên file nhận được và dùng đúng khóa để giải mã</li>
</ol>
