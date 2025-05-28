import os
from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes # Mặc dù không dùng trong decrypt, nhưng có trong encrypt
from Crypto.Util.Padding import pad, unpad
import base64
import json # Hiện tại không dùng trực tiếp json trong logic chính
import hashlib
import logging # Thêm logging

# Thiết lập logging cơ bản
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__, static_folder='client_web/static', template_folder='client_web/templates')
app.config['SECRET_KEY'] = 'your_very_secret_key_for_flask_app_replace_this' # Thay bằng khóa bí mật mạnh
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# UPLOAD_FOLDER và DECRYPTED_FOLDER không được sử dụng trong logic SocketIO hiện tại
# Nếu bạn muốn lưu file trên server, bạn sẽ cần chúng.
# UPLOAD_FOLDER = 'uploads'
# DECRYPTED_FOLDER = 'decrypted'
# if not os.path.exists(UPLOAD_FOLDER):
#     os.makedirs(UPLOAD_FOLDER)
# if not os.path.exists(DECRYPTED_FOLDER):
#     os.makedirs(DECRYPTED_FOLDER)

# --- Các hàm mã hóa/giải mã AES (trên Server) ---
# Hàm aes_encrypt này hiện không được gọi từ client trong kịch bản giải mã lỗi padding
# Nó được dùng nếu client gửi plaintext để server mã hóa.
def aes_encrypt(plaintext_bytes, key_str):
    hashed_key = hashlib.sha256(key_str.encode('utf-8')).digest()
    iv = get_random_bytes(AES.block_size)

    logging.info("\n[SERVER DEBUG - aes_encrypt function]")
    logging.info(f"  Key (string received): '{key_str}'")
    logging.info(f"  Hashed Key (bytes, length: {len(hashed_key)}): {hashed_key.hex()}")
    logging.info(f"  Generated IV (bytes, length: {len(iv)}): {iv.hex()}")
    # logging.info(f"  Plaintext (bytes, length: {len(plaintext_bytes)}): {plaintext_bytes.hex()[:200]}... (first 200 hex chars)")

    cipher = AES.new(hashed_key, AES.MODE_CBC, iv=iv)
    padded_plaintext = pad(plaintext_bytes, AES.block_size)
    ciphertext = cipher.encrypt(padded_plaintext)
    return ciphertext, iv

def aes_decrypt(ciphertext_bytes, iv_bytes, key_str):
    try:
        # Validate inputs
        if not key_str:
            raise ValueError("Key cannot be empty")
        if len(key_str) < 8:
            raise ValueError("Key must be at least 8 characters long")
            
        # Key được băm SHA256 để đảm bảo độ dài 32 bytes (AES-256)
        hashed_key = hashlib.sha256(key_str.encode('utf-8')).digest()
        
        # --- DEBUG: In ra thông tin key, IV, ciphertext (đã chuyển sang bytes) ---
        print("\n[DEBUG SERVER - aes_decrypt function]")
        print(f"  Key (string received): '{key_str}'")
        print(f"  Hashed Key (bytes, length: {len(hashed_key)}): {hashed_key.hex()}")
        print(f"  IV (bytes, length: {len(iv_bytes)}): {iv_bytes.hex()}")
        print(f"  Ciphertext (bytes, length: {len(ciphertext_bytes)}): {ciphertext_bytes.hex()[:200]}... (first 200 hex chars)") # Tránh in quá dài
        # --- END DEBUG ---

        # Validate IV size
        if len(iv_bytes) != AES.block_size:
            raise ValueError(f"IV length is incorrect: expected {AES.block_size}, got {len(iv_bytes)}")
        
        # Validate ciphertext size
        if len(ciphertext_bytes) % AES.block_size != 0:
            raise ValueError(f"Ciphertext length must be a multiple of {AES.block_size}")
        
        cipher = AES.new(hashed_key, AES.MODE_CBC, iv=iv_bytes)
        
        # Giải mã và loại bỏ padding
        decrypted_padded = cipher.decrypt(ciphertext_bytes)
        try:
            decrypted_data = unpad(decrypted_padded, AES.block_size)
            return decrypted_data
        except ValueError as padding_error:
            raise ValueError(f"Padding error - likely incorrect key or corrupted data: {str(padding_error)}")
            
    except Exception as e:
        print(f"Detailed decryption error: {str(e)}")
        raise

@app.route('/')
def index():
    return render_template('encrypt.html')

@app.route('/encrypt')
def encrypt_page():
    return render_template('encrypt.html')

@app.route('/decrypt')
def decrypt_page():
    return render_template('decrypt.html')

@socketio.on('connect')
def test_connect():
    logging.info(f'Client connected: {request.sid}')

@socketio.on('disconnect')
def test_disconnect():
    logging.info(f'Client disconnected: {request.sid}')

# Event này hiện không liên quan trực tiếp đến lỗi padding bạn đang gặp
@socketio.on('upload_plaintext_file')
def handle_upload_plaintext_file(data):
    try:
        base64_plaintext = data['file_content']
        filename = data['filename']
        key_str = data['key']
        file_type = data['file_type']

        logging.info("\n[SERVER DEBUG - handle_upload_plaintext_file]")
        logging.info(f"  Received Filename: '{filename}'")
        logging.info(f"  Received Key (string): '{key_str}'")
        # logging.info(f"  Received Plaintext (Base64, length: {len(base64_plaintext)}): {base64_plaintext[:100]}...")

        plaintext_bytes = base64.b64decode(base64_plaintext)

        try:
            ciphertext_bytes, iv_bytes = aes_encrypt(plaintext_bytes, key_str)
            base64_ciphertext = base64.b64encode(ciphertext_bytes).decode('utf-8')
            base64_iv = base64.b64encode(iv_bytes).decode('utf-8')

            emit('encryption_result', {
                'success': True,
                'message': f"File '{filename}' đã mã hóa thành công trên server.",
                'encrypted_content': base64_ciphertext,
                'iv': base64_iv,
                'original_file_type': file_type,
                'original_filename': filename
            }, room=request.sid)
            logging.info(f"--> SUCCESS: File '{filename}' (plaintext) processed and encrypted by server.")

        except Exception as e:
            error_message = f"LỖI MÃ HÓA (server-side encryption): {str(e)}"
            logging.error(error_message, exc_info=True)
            emit('encryption_result', {
                'success': False, 'message': error_message,
                'encrypted_content': None, 'iv': None
            }, room=request.sid)

    except Exception as e:
        logging.error(f"Lỗi khi xử lý dữ liệu file thô từ client: {e}", exc_info=True)
        emit('encryption_result', {'success': False, 'message': f"Lỗi khi nhận file gốc: {str(e)}"}, room=request.sid)


@socketio.on('upload_encrypted_file')
def handle_upload_encrypted_file(data):
    try:
        base64_ciphertext = data['file_content']
        base64_iv = data['iv']
        filename = data['filename']
        key_str = data['key'] # Key dạng string từ client
        original_file_type = data['original_file_type']

        logging.info("\n[SERVER DEBUG - handle_upload_encrypted_file (receiving from client)]")
        logging.info(f"  Received Filename: '{filename}'")
        logging.info(f"  Received Key (string from client): '{key_str}'")
        logging.info(f"  Received IV (Base64 from client, length: {len(base64_iv)}): {base64_iv}")
        logging.info(f"  Received Ciphertext (Base64 from client, length: {len(base64_ciphertext)}): {base64_ciphertext[:100]}...")
        
        ciphertext_bytes = base64.b64decode(base64_ciphertext)
        iv_bytes = base64.b64decode(base64_iv)

        try:
            decrypted_bytes = aes_decrypt(ciphertext_bytes, iv_bytes, key_str)
            decrypted_base64_content = base64.b64encode(decrypted_bytes).decode('utf-8')
            
            emit('decryption_result', {
                'success': True,
                'message': f"File '{filename}' đã giải mã thành công trên server.",
                'decrypted_file_content': decrypted_base64_content,
                'original_file_type': original_file_type,
                'original_filename': filename # Gửi lại tên file gốc để client dùng khi download
            }, room=request.sid)
            logging.info(f"--> SUCCESS: File '{filename}' đã được giải mã thành công trên server.")

        except ValueError as ve: # Thường là lỗi padding
            error_message = f"LỖI GIẢI MÃ: Key, IV không đúng, hoặc file bị hỏng. Chi tiết: {str(ve)}"
            logging.error(f"--> ERROR: Lỗi giải mã (ValueError) file '{filename}': {ve}", exc_info=False) # exc_info=False vì ValueError thường đủ rõ
            emit('decryption_result', {
                'success': False, 'message': error_message, 'decrypted_file_content': None, 'original_filename': filename
            }, room=request.sid)
        except Exception as e:
            error_message = f"LỖI KHÔNG XÁC ĐỊNH KHI GIẢI MÃ: {str(e)}"
            logging.error(f"--> ERROR: Lỗi giải mã (khác) file '{filename}': {e}", exc_info=True)
            emit('decryption_result', {
                'success': False, 'message': error_message, 'decrypted_file_content': None, 'original_filename': filename
            }, room=request.sid)

    except KeyError as ke:
        logging.error(f"Lỗi thiếu dữ liệu từ client (KeyError): {ke}", exc_info=True)
        emit('decryption_result', {'success': False, 'message': f"Lỗi thiếu dữ liệu từ client: {str(ke)}"}, room=request.sid)
    except base64.binascii.Error as b64e:
        logging.error(f"Lỗi giải mã Base64 từ client: {b64e}", exc_info=True)
        emit('decryption_result', {'success': False, 'message': f"Lỗi dữ liệu Base64 không hợp lệ: {str(b64e)}"}, room=request.sid)
    except Exception as e:
        logging.error(f"Lỗi khi xử lý file mã hóa từ client: {e}", exc_info=True)
        emit('decryption_result', {'success': False, 'message': f"Lỗi khi nhận file mã hóa từ client: {str(e)}"}, room=request.sid)

if __name__ == '__main__':
    try:
        print("Server đang chạy tại http://127.0.0.1:5001")
        print("Vui lòng truy cập địa chỉ này trên trình duyệt của bạn.")
        socketio.run(app, debug=False, host='127.0.0.1', port=5001, allow_unsafe_werkzeug=True)
    except Exception as e:
        print(f"Lỗi khi khởi động server: {e}")