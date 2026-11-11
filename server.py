#!/usr/bin/env python3
"""
NestMate Kerala - Full-Stack Local Server & Authentication REST API
Serves static frontend files and provides secure REST endpoints for:
- Gmail & Password Registration with Password Hashing (PBKDF2-HMAC-SHA256)
- Email Verification (6-digit code with expiration)
- Secure Login & Session Management
- Password Recovery via Recovery Email (Reset Tokens with 15-min expiration)
- Profile Picture & User Profile Management
- Persistent Database File Storage (database.json)
"""

import http.server
import socketserver
import os
import sys
import json
import time
import re
import uuid
import secrets
import hashlib
import hmac
import urllib.parse
import webbrowser

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(DIRECTORY, "database.json")

# ==============================================================================
# Database & Security Helpers
# ==============================================================================

def load_db():
    if not os.path.exists(DB_FILE):
        initial = {"users": [], "listings": []}
        save_db(initial)
        return initial
    try:
        with open(DB_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"users": [], "listings": []}

def save_db(data):
    temp_file = DB_FILE + ".tmp"
    with open(temp_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    if os.path.exists(DB_FILE):
        os.replace(temp_file, DB_FILE)
    else:
        os.rename(temp_file, DB_FILE)

def hash_password(password: str, salt_hex: str = None):
    """Hash password using PBKDF2-HMAC-SHA256 with 100,000 iterations and unique salt."""
    if not salt_hex:
        salt = os.urandom(16)
        salt_hex = salt.hex()
    else:
        salt = bytes.fromhex(salt_hex)
    pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
    return pwd_hash.hex(), salt_hex

def verify_password(password: str, stored_hash: str, salt_hex: str) -> bool:
    """Constant-time verification of password against stored hash."""
    pwd_hash, _ = hash_password(password, salt_hex)
    return hmac.compare_digest(pwd_hash, stored_hash)

def sanitize_user(user):
    """Return user dict without sensitive hashes or verification secrets."""
    safe = dict(user)
    safe.pop("passwordHash", None)
    safe.pop("passwordSalt", None)
    safe.pop("verificationCode", None)
    safe.pop("resetToken", None)
    return safe

def mask_email(email: str) -> str:
    """Mask email for privacy display e.g. a***@example.com"""
    if not email or "@" not in email:
        return "your registered email"
    name, domain = email.split("@", 1)
    if len(name) <= 2:
        masked_name = name[0] + "***"
    else:
        masked_name = name[0] + "***" + name[-1]
    return f"{masked_name}@{domain}"

def is_valid_gmail(email: str) -> bool:
    """Validate that email is a valid Gmail address."""
    pattern = r'^[a-zA-Z0-9](\.?[a-zA-Z0-9_-]+)*@gmail\.com$'
    return bool(re.match(pattern, email.strip(), re.IGNORECASE))

def is_valid_email(email: str) -> bool:
    """Validate general email format."""
    pattern = r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'
    return bool(re.match(pattern, email.strip()))

# ==============================================================================
# Request Handler with REST API & Static File Serving
# ==============================================================================

class NestMateHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Enable CORS and caching headers for local dev
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def guess_type(self, path):
        mtype = super().guess_type(path)
        if path.endswith('.js'):
            return 'application/javascript; charset=utf-8'
        elif path.endswith('.css'):
            return 'text/css; charset=utf-8'
        elif path.endswith('.html'):
            return 'text/html; charset=utf-8'
        elif path.endswith('.json'):
            return 'application/json; charset=utf-8'
        return mtype

    def do_OPTIONS(self):
        """Handle CORS pre-flight requests."""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def send_json(self, status_code, data):
        """Send JSON response with UTF-8 encoding."""
        payload = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()
        self.wfile.write(payload)

    def read_json_body(self):
        """Safely read and parse JSON body from incoming POST request."""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length <= 0:
                return {}
            body = self.rfile.read(content_length).decode('utf-8')
            return json.loads(body)
        except Exception:
            return {}

    # --------------------------------------------------------------------------
    # API Router
    # --------------------------------------------------------------------------

    def do_GET(self):
        path = self.path.split('?')[0]

        if path == "/api/database/status":
            db = load_db()
            return self.send_json(200, {
                "status": "online",
                "usersCount": len(db.get("users", [])),
                "listingsCount": len(db.get("listings", []))
            })

        if path == "/api/database/users":
            db = load_db()
            safe_users = [sanitize_user(u) for u in db.get("users", [])]
            return self.send_json(200, {"users": safe_users})

        if path == "/api/listings":
            return self.handle_get_listings()

        # Static file fallback
        super().do_GET()

    def do_POST(self):
        path = self.path.split('?')[0]
        data = self.read_json_body()

        # 1. REGISTER
        if path == "/api/auth/register":
            return self.handle_register(data)

        # 2. VERIFY EMAIL
        elif path == "/api/auth/verify":
            return self.handle_verify_email(data)

        # 3. RESEND VERIFICATION CODE
        elif path == "/api/auth/resend-code":
            return self.handle_resend_code(data)

        # 4. LOGIN
        elif path == "/api/auth/login":
            return self.handle_login(data)

        # 5. FORGOT PASSWORD
        elif path == "/api/auth/forgot-password":
            return self.handle_forgot_password(data)

        # 6. RESET PASSWORD
        elif path == "/api/auth/reset-password":
            return self.handle_reset_password(data)

        # 7. UPDATE PROFILE
        elif path == "/api/user/profile":
            return self.handle_update_profile(data)

        # 8. CHANGE PASSWORD
        elif path == "/api/user/change-password":
            return self.handle_change_password(data)

        # 9. UPDATE AVATAR
        elif path == "/api/user/avatar":
            return self.handle_update_avatar(data)

        # 10. PUBLISH NEW LISTING
        elif path == "/api/listings":
            return self.handle_save_listing(data)

        # 11. UPDATE EXISTING LISTING
        elif path == "/api/listings/update":
            return self.handle_update_listing(data)

        # 12. UPDATE LISTING STATUS (ACTIVE, INACTIVE, RENTED, DELETED)
        elif path == "/api/listings/status":
            return self.handle_update_listing_status(data)

        # 13. DELETE LISTING
        elif path == "/api/listings/delete":
            return self.handle_delete_listing(data)

        else:
            self.send_json(404, {"error": "API route not found"})

    def do_DELETE(self):
        path = self.path.split('?')[0]
        data = self.read_json_body()

        if path == "/api/user/avatar":
            user_id = data.get("userId")
            db = load_db()
            for user in db.get("users", []):
                if user.get("id") == user_id:
                    user["avatar"] = ""
                    save_db(db)
                    return self.send_json(200, {"success": True, "user": sanitize_user(user)})
            return self.send_json(404, {"error": "User not found"})

        if path == "/api/listings":
            return self.handle_delete_listing(data)

        super().do_GET()

    # --------------------------------------------------------------------------
    # Auth Endpoints Implementation
    # --------------------------------------------------------------------------

    def handle_register(self, data):
        name = (data.get("name") or "").strip()
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""
        confirm_password = data.get("confirmPassword") or ""
        recovery_email = (data.get("recoveryEmail") or "").strip().lower()
        avatar = data.get("avatar") or ""

        # Validations
        if not name:
            return self.send_json(400, {"error": "Full Name is required."})

        if not is_valid_gmail(email):
            return self.send_json(400, {"error": "Please enter a valid Gmail address (ending in @gmail.com)."})

        if not is_valid_email(recovery_email):
            return self.send_json(400, {"error": "Please enter a valid recovery email address."})

        if email == recovery_email:
            return self.send_json(400, {"error": "Recovery email must be different from your primary Gmail address."})

        if len(password) < 8:
            return self.send_json(400, {"error": "Password must be at least 8 characters long."})

        if password != confirm_password:
            return self.send_json(400, {"error": "Password and Confirm Password do not match."})

        db = load_db()
        users = db.get("users", [])

        # Check existing Gmail
        for u in users:
            if u.get("email", "").lower() == email:
                return self.send_json(400, {"error": "This Gmail address is already registered. Please log in instead."})

        # Hash password securely with fresh salt
        pwd_hash, salt_hex = hash_password(password)

        # Generate 6-digit verification code with 15 minutes expiration
        verification_code = f"{secrets.randbelow(900000) + 100000}"
        verification_expires = time.time() + (15 * 60) # 15 mins

        new_user = {
            "id": f"usr_{int(time.time() * 1000)}",
            "name": name,
            "email": email,
            "passwordHash": pwd_hash,
            "passwordSalt": salt_hex,
            "recoveryEmail": recovery_email,
            "avatar": avatar,
            "isVerified": False,
            "verificationCode": verification_code,
            "verificationExpires": verification_expires,
            "resetToken": None,
            "resetExpires": None,
            "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "occupation": data.get("occupation", "Working Professional in Kerala"),
            "age": data.get("age", 25),
            "gender": data.get("gender", "Any"),
            "smoking": data.get("smoking", "no"),
            "drinking": data.get("drinking", "social"),
            "workingShift": data.get("workingShift", "day"),
            "cleanliness": data.get("cleanliness", "high"),
            "budget": data.get("budget", 7000),
            "diet": data.get("diet", "any"),
            "bio": data.get("bio", "")
        }

        users.append(new_user)
        db["users"] = users
        save_db(db)

        return self.send_json(201, {
            "success": True,
            "message": f"Verification code sent to {email}. Valid for 15 minutes.",
            "email": email,
            "recoveryEmail": mask_email(recovery_email),
            "verificationCode": verification_code # included for developer/testing ease
        })

    def handle_verify_email(self, data):
        email = (data.get("email") or "").strip().lower()
        code = (data.get("code") or "").strip()

        if not email or not code:
            return self.send_json(400, {"error": "Email and verification code are required."})

        db = load_db()
        users = db.get("users", [])

        user = next((u for u in users if u.get("email", "").lower() == email), None)
        if not user:
            return self.send_json(404, {"error": "User account not found."})

        if user.get("isVerified"):
            return self.send_json(200, {
                "success": True,
                "message": "Account already verified.",
                "user": sanitize_user(user)
            })

        stored_code = user.get("verificationCode")
        expires = user.get("verificationExpires", 0)

        if time.time() > expires:
            return self.send_json(400, {"error": "Verification code has expired. Please request a new one."})

        if stored_code != code:
            return self.send_json(400, {"error": "Invalid verification code. Please check and try again."})

        # Mark verified and clear verification code
        user["isVerified"] = True
        user["verificationCode"] = None
        user["verificationExpires"] = None
        save_db(db)

        return self.send_json(200, {
            "success": True,
            "message": "Gmail verified successfully! Your account is now active.",
            "user": sanitize_user(user)
        })

    def handle_resend_code(self, data):
        email = (data.get("email") or "").strip().lower()
        db = load_db()
        users = db.get("users", [])
        user = next((u for u in users if u.get("email", "").lower() == email), None)

        if not user:
            return self.send_json(404, {"error": "User account not found."})

        verification_code = f"{secrets.randbelow(900000) + 100000}"
        user["verificationCode"] = verification_code
        user["verificationExpires"] = time.time() + (15 * 60)
        save_db(db)

        return self.send_json(200, {
            "success": True,
            "message": f"New verification code sent to {email}.",
            "verificationCode": verification_code
        })

    def handle_login(self, data):
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""

        if not is_valid_gmail(email):
            return self.send_json(400, {"error": "Please enter a valid Gmail address (ending in @gmail.com)."})

        if not password:
            return self.send_json(400, {"error": "Password is required."})

        db = load_db()
        users = db.get("users", [])
        user = next((u for u in users if u.get("email", "").lower() == email), None)

        if not user:
            return self.send_json(401, {"error": "No registered account found with this Gmail address."})

        # Check password
        stored_hash = user.get("passwordHash", "")
        salt_hex = user.get("passwordSalt", "")

        if not verify_password(password, stored_hash, salt_hex):
            return self.send_json(401, {"error": "Incorrect password. Please try again or use Forgot Password."})

        # Check if email is verified
        if not user.get("isVerified", False):
            # Keep existing code if still valid, otherwise regenerate
            if not user.get("verificationCode") or time.time() > user.get("verificationExpires", 0):
                user["verificationCode"] = f"{secrets.randbelow(900000) + 100000}"
                user["verificationExpires"] = time.time() + (15 * 60)
                save_db(db)

            return self.send_json(403, {
                "error": "Your Gmail address has not been verified yet.",
                "needsVerification": True,
                "email": email,
                "verificationCode": user.get("verificationCode")
            })

        return self.send_json(200, {
            "success": True,
            "message": f"Welcome back, {user.get('name')}!",
            "user": sanitize_user(user)
        })

    def handle_forgot_password(self, data):
        email = (data.get("email") or "").strip().lower()

        if not is_valid_gmail(email):
            return self.send_json(400, {"error": "Please enter a valid Gmail address."})

        db = load_db()
        users = db.get("users", [])
        user = next((u for u in users if u.get("email", "").lower() == email), None)

        if not user:
            return self.send_json(404, {"error": "No account found registered with this Gmail address."})

        recovery_email = user.get("recoveryEmail", "")
        if not recovery_email:
            return self.send_json(400, {"error": "No recovery email registered for this account. Please contact support."})

        # Generate secure random reset token
        reset_token = secrets.token_urlsafe(32)
        user["resetToken"] = reset_token
        user["resetExpires"] = time.time() + (15 * 60) # 15 mins
        save_db(db)

        return self.send_json(200, {
            "success": True,
            "message": f"A secure password reset link has been dispatched to your recovery email.",
            "recoveryEmail": mask_email(recovery_email),
            "resetToken": reset_token # included for simulation/smooth browser reset
        })

    def handle_reset_password(self, data):
        token = (data.get("token") or "").strip()
        new_password = data.get("newPassword") or ""
        confirm_password = data.get("confirmPassword") or ""

        if not token:
            return self.send_json(400, {"error": "Password reset token is required."})

        if len(new_password) < 8:
            return self.send_json(400, {"error": "New password must be at least 8 characters long."})

        if new_password != confirm_password:
            return self.send_json(400, {"error": "New password and Confirm Password do not match."})

        db = load_db()
        users = db.get("users", [])
        user = next((u for u in users if u.get("resetToken") == token), None)

        if not user:
            return self.send_json(400, {"error": "Invalid or expired password reset token."})

        if time.time() > user.get("resetExpires", 0):
            return self.send_json(400, {"error": "This password reset token has expired. Please request a new link."})

        # Hash new password with fresh salt
        pwd_hash, salt_hex = hash_password(new_password)
        user["passwordHash"] = pwd_hash
        user["passwordSalt"] = salt_hex
        user["resetToken"] = None
        user["resetExpires"] = None
        save_db(db)

        return self.send_json(200, {
            "success": True,
            "message": "Password successfully updated! You can now sign in with your new password."
        })

    def handle_update_profile(self, data):
        user_id = data.get("userId")
        if not user_id:
            return self.send_json(400, {"error": "User ID is required."})

        db = load_db()
        users = db.get("users", [])
        user = next((u for u in users if u.get("id") == user_id), None)

        if not user:
            return self.send_json(404, {"error": "User account not found."})

        # Editable fields
        if "name" in data and data["name"].strip():
            user["name"] = data["name"].strip()

        if "recoveryEmail" in data and data["recoveryEmail"].strip():
            new_rec = data["recoveryEmail"].strip().lower()
            if not is_valid_email(new_rec):
                return self.send_json(400, {"error": "Invalid recovery email format."})
            if new_rec == user.get("email", "").lower():
                return self.send_json(400, {"error": "Recovery email cannot be the same as your Gmail address."})
            user["recoveryEmail"] = new_rec

        if "avatar" in data:
            user["avatar"] = data["avatar"]

        for field in ["occupation", "age", "gender", "smoking", "drinking", "workingShift", "cleanliness", "budget", "diet", "bio"]:
            if field in data:
                user[field] = data[field]

        save_db(db)

        return self.send_json(200, {
            "success": True,
            "message": "Profile updated successfully!",
            "user": sanitize_user(user)
        })

    def handle_change_password(self, data):
        user_id = data.get("userId")
        current_password = data.get("currentPassword") or ""
        new_password = data.get("newPassword") or ""
        confirm_password = data.get("confirmPassword") or ""

        if not user_id:
            return self.send_json(400, {"error": "User ID is required."})

        if len(new_password) < 8:
            return self.send_json(400, {"error": "New password must be at least 8 characters long."})

        if new_password != confirm_password:
            return self.send_json(400, {"error": "New password and Confirm Password do not match."})

        db = load_db()
        users = db.get("users", [])
        user = next((u for u in users if u.get("id") == user_id), None)

        if not user:
            return self.send_json(404, {"error": "User account not found."})

        # Verify current password
        stored_hash = user.get("passwordHash", "")
        salt_hex = user.get("passwordSalt", "")
        if not verify_password(current_password, stored_hash, salt_hex):
            return self.send_json(401, {"error": "Current password does not match our records."})

        # Hash new password
        pwd_hash, salt_hex = hash_password(new_password)
        user["passwordHash"] = pwd_hash
        user["passwordSalt"] = salt_hex
        save_db(db)

        return self.send_json(200, {
            "success": True,
            "message": "Password changed successfully!"
        })

    def handle_update_avatar(self, data):
        user_id = data.get("userId")
        avatar = data.get("avatar") or ""

        if not user_id:
            return self.send_json(400, {"error": "User ID is required."})

        db = load_db()
        users = db.get("users", [])
        user = next((u for u in users if u.get("id") == user_id), None)

        if not user:
            return self.send_json(404, {"error": "User account not found."})

        user["avatar"] = avatar
        save_db(db)

        return self.send_json(200, {
            "success": True,
            "message": "Profile picture updated!",
            "avatar": avatar,
            "user": sanitize_user(user)
        })

    # --------------------------------------------------------------------------
    # Room Listings Endpoints Implementation
    # --------------------------------------------------------------------------

    def handle_get_listings(self):
        db = load_db()
        listings = db.get("listings", [])

        # Parse query parameters
        params = {}
        if '?' in self.path:
            query = self.path.split('?', 1)[1]
            for pair in query.split('&'):
                if '=' in pair:
                    k, v = pair.split('=', 1)
                    params[k] = urllib.parse.unquote(v)

        listing_id = params.get("id")
        if listing_id:
            for item in listings:
                if item.get("id") == listing_id:
                    return self.send_json(200, {"listing": item})
            return self.send_json(404, {"error": "Listing not found"})

        owner_id = params.get("userId")
        if owner_id:
            user_listings = [
                item for item in listings
                if (item.get("userId") == owner_id or item.get("hostId") == owner_id)
                and item.get("status") != "DELETED"
            ]
            return self.send_json(200, {"listings": user_listings})

        status_filter = params.get("status", "ACTIVE")
        if status_filter != "all":
            filtered = [
                item for item in listings
                if item.get("status", "ACTIVE").upper() == status_filter.upper()
            ]
        else:
            filtered = [item for item in listings if item.get("status") != "DELETED"]

        return self.send_json(200, {"listings": filtered})

    def handle_save_listing(self, data):
        title = (data.get("title") or "").strip()
        location = (data.get("location") or "").strip()
        rent_split = data.get("rentSplit") or data.get("monthlyRent") or 0

        if not title:
            return self.send_json(400, {"error": "Room title is required."})
        if not location:
            return self.send_json(400, {"error": "Location in Kerala is required."})
        if not rent_split:
            return self.send_json(400, {"error": "Monthly rent split is required."})

        db = load_db()
        listings = db.get("listings", [])

        listing_id = data.get("id") or f"room_{int(time.time() * 1000)}"
        now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        # Up to 15 images
        images = data.get("images", [])
        if not isinstance(images, list):
            images = [images] if images else []
        images = images[:15]
        cover_image = data.get("coverImage") or (images[0] if images else "")

        new_listing = {
            "id": listing_id,
            "userId": data.get("userId") or data.get("hostId", ""),
            "hostId": data.get("hostId") or data.get("userId", ""),
            "hostName": data.get("hostName", "Host in Kerala"),
            "hostAvatar": data.get("hostAvatar", ""),
            "hostEmail": data.get("hostEmail", ""),
            "hostPhone": data.get("hostPhone", ""),
            "hostOccupation": data.get("hostOccupation", "Working Professional"),
            "title": title,
            "description": (data.get("description") or "").strip(),
            "propertyType": data.get("propertyType", "Apartment"),
            "roomType": data.get("roomType", "Single Room"),
            "location": location,
            "neighborhood": location.split(',')[0].strip(),
            "address": (data.get("address") or location).strip(),
            "city": data.get("city", "Kerala"),
            "rentSplit": float(rent_split),
            "monthlyRent": float(rent_split),
            "deposit": float(data.get("deposit") or (float(rent_split) * 2)),
            "billsIncluded": bool(data.get("billsIncluded", True)),
            "roommatesNeeded": int(data.get("roommatesNeeded") or data.get("availableSpaces") or 1),
            "availableSpaces": int(data.get("availableSpaces") or data.get("roommatesNeeded") or 1),
            "genderPreference": data.get("genderPreference", "any"),
            "availableFrom": data.get("availableFrom", "Immediate"),
            "smokingRule": data.get("smokingRule", "no"),
            "drinkingRule": data.get("drinkingRule", "social"),
            "workingShiftPreference": data.get("workingShiftPreference", "any"),
            "cleanlinessExpectation": data.get("cleanlinessExpectation", "high"),
            "amenities": data.get("amenities") or ["High-Speed WiFi", "Attached Bathroom"],
            "coverImage": cover_image,
            "images": images,
            "status": "ACTIVE",
            "createdAt": now_iso,
            "updatedAt": now_iso
        }

        listings.insert(0, new_listing)
        db["listings"] = listings
        save_db(db)

        return self.send_json(201, {
            "success": True,
            "message": "Your room has been published successfully!",
            "listing": new_listing
        })

    def handle_update_listing(self, data):
        listing_id = data.get("id")
        user_id = data.get("userId") or data.get("hostId")

        if not listing_id:
            return self.send_json(400, {"error": "Listing ID is required."})

        db = load_db()
        listings = db.get("listings", [])
        listing = next((l for l in listings if l.get("id") == listing_id), None)

        if not listing:
            return self.send_json(404, {"error": "Listing not found."})

        for field in ["title", "description", "roomType", "location", "address", "genderPreference", "availableFrom", "smokingRule", "drinkingRule", "workingShiftPreference"]:
            if field in data and data[field] is not None:
                listing[field] = data[field]

        if "rentSplit" in data and data["rentSplit"]:
            val = float(data["rentSplit"])
            listing["rentSplit"] = val
            listing["monthlyRent"] = val

        if "deposit" in data and data["deposit"]:
            listing["deposit"] = float(data["deposit"])

        if "roommatesNeeded" in data or "availableSpaces" in data:
            spaces = int(data.get("roommatesNeeded") or data.get("availableSpaces") or 1)
            listing["roommatesNeeded"] = spaces
            listing["availableSpaces"] = spaces

        if "amenities" in data and isinstance(data["amenities"], list):
            listing["amenities"] = data["amenities"]

        if "images" in data and isinstance(data["images"], list):
            listing["images"] = data["images"][:15]

        if "coverImage" in data and data["coverImage"]:
            listing["coverImage"] = data["coverImage"]
        elif listing.get("images"):
            listing["coverImage"] = listing["images"][0]

        listing["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        save_db(db)

        return self.send_json(200, {
            "success": True,
            "message": "Room listing updated successfully!",
            "listing": listing
        })

    def handle_update_listing_status(self, data):
        listing_id = data.get("listingId") or data.get("id")
        new_status = (data.get("status") or "").upper()

        if not listing_id:
            return self.send_json(400, {"error": "Listing ID is required."})

        valid_statuses = ["ACTIVE", "INACTIVE", "RENTED", "DELETED"]
        if new_status not in valid_statuses:
            return self.send_json(400, {"error": f"Invalid status. Must be one of: {', '.join(valid_statuses)}"})

        db = load_db()
        listings = db.get("listings", [])
        listing = next((l for l in listings if l.get("id") == listing_id), None)

        if not listing:
            return self.send_json(404, {"error": "Listing not found."})

        listing["status"] = new_status
        listing["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        save_db(db)

        status_messages = {
            "ACTIVE": "Listing is now ACTIVE and live in Available Properties.",
            "INACTIVE": "Listing has been PAUSED (hidden from public view).",
            "RENTED": "Listing marked as RENTED.",
            "DELETED": "Listing deleted successfully."
        }

        return self.send_json(200, {
            "success": True,
            "message": status_messages.get(new_status, f"Status updated to {new_status}"),
            "listing": listing
        })

    def handle_delete_listing(self, data):
        listing_id = data.get("listingId") or data.get("id")
        if not listing_id:
            return self.send_json(400, {"error": "Listing ID is required."})

        db = load_db()
        listings = db.get("listings", [])
        db["listings"] = [l for l in listings if l.get("id") != listing_id]
        save_db(db)

        return self.send_json(200, {
            "success": True,
            "message": "Listing deleted permanently from database!"
        })

# ==============================================================================
# Server Runner
# ==============================================================================

def run_server():
    os.chdir(DIRECTORY)
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    # Initialize database file if not present
    load_db()

    socketserver.TCPServer.allow_reuse_address = True
    
    ports = [8000, 8080, 5000, 3000, 8888]
    httpd = None
    active_port = PORT
    
    for p in ports:
        try:
            httpd = socketserver.TCPServer(("", p), NestMateHandler)
            active_port = p
            break
        except OSError:
            continue
            
    if not httpd:
        httpd = socketserver.TCPServer(("", 0), NestMateHandler)
        active_port = httpd.server_address[1]

    url = f"http://localhost:{active_port}"
    print("=" * 65)
    print("  NestMate Kerala - Full-Stack Local Server & Auth API")
    print("=" * 65)
    print(f"  > Server URL: {url}")
    print(f"  > Database: {DB_FILE}")
    print(f"  > Serving files from: {DIRECTORY}")
    print("  > Authentication: Gmail & Password (PBKDF2-HMAC-SHA256)")
    print("  > Recovery: Secure Token via Recovery Email")
    print("=" * 65)
    
    # Auto-open browser
    try:
        webbrowser.open(url)
    except Exception:
        pass

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down NestMate server. Goodbye!")

if __name__ == "__main__":
    run_server()
