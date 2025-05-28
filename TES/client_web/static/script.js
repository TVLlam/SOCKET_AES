// Kết nối tới Socket.IO server
const socket = io('http://127.0.0.1:5000'); // Thay đổi nếu server chạy trên địa chỉ/port khác

// Element DOM (được truy cập dựa trên trang hiện tại)
let clientFileInput, clientKeyCode, encryptAndSendButton;
let serverDecryptedOutputText, serverDecryptedOutputImage, downloadServerDecryptedButton;
let clientStatusDiv; // Dùng chung cho cả hai trang để hiển thị trạng thái kết nối

// --- Initialize Elements based on current page ---
function initializePageElements() {
    clientStatusDiv = document.getElementById('clientStatus'); // Element chung cho status

    if (document.getElementById('encrypt-section')) {
        // Elements for Encrypt Page
        clientFileInput = document.getElementById('clientFileInput');
        clientKeyCode = document.getElementById('clientKeyCode');
        encryptAndSendButton = document.getElementById('encryptAndSendButton');

        if (encryptAndSendButton) {
            encryptAndSendButton.addEventListener('click', encryptAndSendFile);
        }
    } else if (document.getElementById('decrypt-section')) {
        // Elements for Decrypt Page
        serverDecryptedOutputText = document.getElementById('serverDecryptedOutputText');
        serverDecryptedOutputImage = document.getElementById('serverDecryptedOutputImage');
        downloadServerDecryptedButton = document.getElementById('downloadServerDecryptedButton');

        // No specific button for decrypt page, data comes from server
    }
}


// --- Socket.IO Event Handlers ---
socket.on('connect', () => {
    if (clientStatusDiv) {
        clientStatusDiv.textContent = 'Kết nối tới Server thành công.';
        clientStatusDiv.style.color = 'green';
    }
    console.log('[DEBUG CLIENT] Connected to server');
});

socket.on('disconnect', () => {
    if (clientStatusDiv) {
        clientStatusDiv.textContent = 'Mất kết nối tới Server.';
        clientStatusDiv.style.color = 'red';
    }
    console.log('[DEBUG CLIENT] Disconnected from server');
});

socket.on('decryption_result', (data) => {
    console.log("[DEBUG CLIENT] Received 'decryption_result':", data);
    // Đảm bảo chỉ xử lý nếu đang ở trang giải mã và các element tồn tại
    if (document.getElementById('decrypt-section') && serverDecryptedOutputText && serverDecryptedOutputImage && downloadServerDecryptedButton) {
        if (data.success) {
            if (clientStatusDiv) clientStatusDiv.textContent = `Server báo cáo: ${data.message}`;
            displayServerDecryptedFile(data.decrypted_file_content, data.original_file_type, data.original_filename || "decrypted_file"); // Thêm original_filename
            console.log(`[DEBUG CLIENT] Decryption success for '${data.original_filename}'`);
        } else {
            if (clientStatusDiv) clientStatusDiv.textContent = `Server báo cáo lỗi: ${data.message}`;
            serverDecryptedOutputText.style.display = 'block';
            serverDecryptedOutputText.textContent = `Lỗi giải mã từ Server: ${data.message}`;
            serverDecryptedOutputImage.style.display = 'none';
            serverDecryptedOutputImage.src = ''; // Clear image
            downloadServerDecryptedButton.style.display = 'none';
            console.error(`[DEBUG CLIENT] Decryption failed. Message: ${data.message}`);
        }
    } else {
        console.warn("[DEBUG CLIENT] Received 'decryption_result' but not on decrypt page or elements missing. Data:", data);
        if (clientStatusDiv) { // Cập nhật status chung nếu không ở trang decrypt
             clientStatusDiv.textContent = data.success ? 'Server đã giải mã thành công (không hiển thị)!' : `Server lỗi giải mã (không hiển thị): ${data.message}`;
        }
    }
});

// --- Hàm mã hóa và gửi file lên Server ---
async function encryptAndSendFile() {
    if (!clientFileInput || !clientKeyCode) {
        console.error("[DEBUG CLIENT] encryptAndSendFile: Input elements not found.");
        if (clientStatusDiv) clientStatusDiv.textContent = 'Lỗi: Không tìm thấy các thành phần giao diện.';
        return;
    }

    const file = clientFileInput.files[0];
    const keyString = clientKeyCode.value; // Đây là key người dùng nhập (string)

    // Reset hiển thị
    if (clientStatusDiv) clientStatusDiv.textContent = 'Đang xử lý...';

    if (!file) {
        alert('Vui lòng chọn file để mã hóa và gửi.');
        if (clientStatusDiv) clientStatusDiv.textContent = 'Lỗi: Chưa chọn file.';
        return;
    }
    if (!keyString) {
        alert('Vui lòng nhập khóa (Key).');
        if (clientStatusDiv) clientStatusDiv.textContent = 'Lỗi: Chưa nhập khóa.';
        return;
    }
    // Không cần kiểm tra độ dài key ở đây nữa, server sẽ hash nó thành 32 bytes.

    try {
        const arrayBuffer = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });

        const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);

        // --- QUAN TRỌNG: Xử lý KEY và IV cho CryptoJS ---
        // 1. Chuyển key string sang WordArray (UTF-8) để hash
        const keyForHashing = CryptoJS.enc.Utf8.parse(keyString);
        // 2. Hash key string bằng SHA256 để có key 32 bytes (256 bits)
        const hashedKey = CryptoJS.SHA256(keyForHashing); // Đây là WordArray, sẽ được dùng làm key mã hóa
        // 3. Tạo IV ngẫu nhiên (16 bytes = 128 bits)
        const iv = CryptoJS.lib.WordArray.random(128 / 8); // 16 bytes
        // --- KẾT THÚC XỬ LÝ KEY và IV ---

        const encrypted = CryptoJS.AES.encrypt(wordArray, hashedKey, { // Sử dụng HASHED KEY
            iv: iv, // Sử dụng IV đã tạo
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });

        const iv_base64 = CryptoJS.enc.Base64.stringify(iv); // Chuyển IV (WordArray) sang Base64
        const ciphertext_base64 = encrypted.ciphertext.toString(CryptoJS.enc.Base64);

        // --- DEBUG LOGS ---
        console.log("\n[DEBUG CLIENT - encryptAndSendFile]");
        console.log("  Original Key String (sent to server):", keyString);
        console.log("  Hashed Key (used for encryption, hex):", hashedKey.toString(CryptoJS.enc.Hex));
        console.log("  IV (used for encryption, hex):", iv.toString(CryptoJS.enc.Hex));
        console.log("  IV (Base64 sent to server, length:", iv_base64.length, "):", iv_base64);
        console.log("  Ciphertext (Base64 sent to server, length:", ciphertext_base64.length, "):", ciphertext_base64.substring(0, 100) + '...');
        console.log("  Original File Type:", file.type);
        console.log("  Original File Size:", file.size, "bytes");
        // --- END DEBUG LOGS ---

        if (clientStatusDiv) clientStatusDiv.textContent = 'Đang gửi file đã mã hóa lên Server...';
        socket.emit('upload_encrypted_file', {
            file_content: ciphertext_base64,
            iv: iv_base64,
            filename: file.name,
            key: keyString, // Gửi KEY GỐC (STRING) lên server, server sẽ tự hash
            original_file_type: file.type
        });
        console.log(`[DEBUG CLIENT] File '${file.name}' encrypted and an instruction to decrypt it was sent to server.`);

    } catch (error) {
        console.error('[DEBUG CLIENT] Lỗi mã hóa hoặc gửi file:', error);
        if (clientStatusDiv) clientStatusDiv.textContent = `Lỗi: ${error.message}`;
        alert('Đã xảy ra lỗi trong quá trình mã hóa hoặc gửi file: ' + error.message);
    }
}

// Hàm hiển thị file đã giải mã từ Server
function displayServerDecryptedFile(base64Content, mimeType, filename) {
    if (!base64Content || !mimeType) { // filename có thể không có ban đầu
        console.error("[DEBUG CLIENT] displayServerDecryptedFile called with missing content or mimeType.");
        if (serverDecryptedOutputText) serverDecryptedOutputText.textContent = 'Lỗi: Dữ liệu giải mã không đầy đủ từ server.';
        if (serverDecryptedOutputImage) serverDecryptedOutputImage.style.display = 'none';
        if (downloadServerDecryptedButton) downloadServerDecryptedButton.style.display = 'none';
        return;
    }
    if (!serverDecryptedOutputText || !serverDecryptedOutputImage || !downloadServerDecryptedButton) {
        console.error("[DEBUG CLIENT] displayServerDecryptedFile called but crucial DOM elements not found.");
        return;
    }


    serverDecryptedOutputText.textContent = ''; // Clear previous content
    serverDecryptedOutputImage.src = ''; // Clear previous image
    serverDecryptedOutputImage.style.display = 'none';
    serverDecryptedOutputText.style.display = 'none';


    const decryptedArrayBuffer = base64ToArrayBuffer(base64Content);
    if (!decryptedArrayBuffer || decryptedArrayBuffer.byteLength === 0 && base64Content.length > 0) {
        // Lỗi base64ToArrayBuffer hoặc trả về buffer rỗng dù có content
        serverDecryptedOutputText.textContent = 'Lỗi: Không thể chuyển đổi dữ liệu giải mã từ server.';
        serverDecryptedOutputText.style.display = 'block';
        downloadServerDecryptedButton.style.display = 'none';
        return;
    }

    const blob = new Blob([decryptedArrayBuffer], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const safeFilename = filename || `decrypted_file.${mimeType.split('/')[1] || 'bin'}`;


    if (mimeType.startsWith('image/')) {
        serverDecryptedOutputImage.src = url;
        serverDecryptedOutputImage.style.display = 'block';
        serverDecryptedOutputText.style.display = 'none';
        serverDecryptedOutputImage.dataset.blobUrl = url; // Lưu để revoke
    } else if (mimeType.startsWith('text/')) {
        const textDecoder = new TextDecoder('utf-8'); // Mặc định UTF-8
        try {
            serverDecryptedOutputText.textContent = 'Nội dung file giải mã:\n' + textDecoder.decode(decryptedArrayBuffer);
        } catch (e) {
            // Thử fallback nếu UTF-8 lỗi, hoặc báo lỗi
            try {
                const latin1Text = new TextDecoder('latin1').decode(decryptedArrayBuffer);
                 serverDecryptedOutputText.textContent = 'Nội dung file giải mã (thử đọc là Latin-1):\n' + latin1Text;
            } catch (e2) {
                 serverDecryptedOutputText.textContent = 'Nội dung file giải mã (không thể đọc dưới dạng văn bản).\n Vui lòng tải xuống.';
                 console.warn('[DEBUG CLIENT] Could not decode text file content as UTF-8 or Latin-1:', e, e2);
            }
        }
        serverDecryptedOutputText.style.display = 'block';
        serverDecryptedOutputImage.style.display = 'none';
    } else {
        serverDecryptedOutputText.textContent = `File đã được giải mã từ Server. Loại file "${mimeType}". Không thể hiển thị trực tiếp. Vui lòng tải xuống để mở.`;
        serverDecryptedOutputText.style.display = 'block';
        serverDecryptedOutputImage.style.display = 'none';
    }

    downloadServerDecryptedButton.style.display = 'block';
    downloadServerDecryptedButton.onclick = () => {
        const a = document.createElement('a');
        a.href = url;
        a.download = safeFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // Không revoke URL ở đây nếu muốn link vẫn hoạt động hoặc hình ảnh hiển thị
        console.log(`[DEBUG CLIENT] Download initiated for '${safeFilename}'. Blob URL (do not revoke immediately if image is displayed): ${url}`);
    };
}


// --- Hàm tiện ích chung ---
function base64ToArrayBuffer(base64) {
    try {
        const binary_string = atob(base64);
        const len = binary_string.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary_string.charCodeAt(i);
        }
        return bytes.buffer;
    } catch (e) {
        console.error('[DEBUG CLIENT] Error converting Base64 to ArrayBuffer:', e, "Input base64 string (first 100 chars):", base64.substring(0,100));
        // alert('Lỗi chuyển đổi dữ liệu Base64 nhận được từ server.');
        if (clientStatusDiv) clientStatusDiv.textContent = 'Lỗi: Dữ liệu Base64 từ server không hợp lệ.';
        if (serverDecryptedOutputText && document.getElementById('decrypt-section')) { // Chỉ hiển thị lỗi này nếu đang ở trang decrypt
            serverDecryptedOutputText.textContent = `Lỗi xử lý dữ liệu Base64 từ server: ${e.message}. Dữ liệu có thể bị hỏng.`;
            serverDecryptedOutputText.style.display = 'block';
        }
        return null; // Trả về null để hàm gọi có thể kiểm tra
    }
}

// Thu hồi URL Blob khi đóng trang hoặc chuyển hướng để tránh rò rỉ bộ nhớ
window.addEventListener('beforeunload', () => {
    const imageElem = serverDecryptedOutputImage || document.getElementById('serverDecryptedOutputImage');
    if (imageElem && imageElem.dataset.blobUrl) {
        URL.revokeObjectURL(imageElem.dataset.blobUrl);
        console.log('[DEBUG CLIENT] Revoked Blob URL on unload:', imageElem.dataset.blobUrl);
        delete imageElem.dataset.blobUrl;
    }
    // Nếu có nhiều blob URLs khác, cũng revoke ở đây
});

// Chạy khởi tạo DOM elements sau khi trang tải xong
document.addEventListener('DOMContentLoaded', initializePageElements);