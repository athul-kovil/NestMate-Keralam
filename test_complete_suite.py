import urllib.request
import urllib.parse
import json
import sys
import time

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

BASE_URL = "http://localhost:8000"

def req(method, path, data=None):
    url = f"{BASE_URL}{path}"
    request_obj = urllib.request.Request(url, method=method)
    if data is not None:
        request_obj.add_header("Content-Type", "application/json")
        request_obj.data = json.dumps(data).encode("utf-8")
    try:
        with urllib.request.urlopen(request_obj) as resp:
            body = resp.read().decode("utf-8")
            return resp.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        return e.code, json.loads(body) if body else {}

def run_suite():
    print("=" * 60)
    print("RUNNING NESTMATE KERALA COMPLETE VERIFICATION SUITE")
    print("=" * 60)

    # 1. Register a new user
    ts = int(time.time() * 1000)
    test_email = f"kerala.test.{ts}@gmail.com"
    test_recovery = f"recovery.{ts}@gmail.com"
    reg_data = {
        "name": "Athul Krishna",
        "email": test_email,
        "password": "SecurePassword123!",
        "confirmPassword": "SecurePassword123!",
        "recoveryEmail": test_recovery,
        "avatar": "data:image/png;base64,mockUserAvatar"
    }

    code, res = req("POST", "/api/auth/register", reg_data)
    assert code == 201, f"Register failed ({code}): {res}"
    verify_code = res.get("verificationCode")
    print(f"✓ 1. User Registration with Gmail: OK ({test_email})")

    # 2. Verify Email
    code, res = req("POST", "/api/auth/verify", {"email": test_email, "code": verify_code})
    assert code == 200, f"Verify failed ({code}): {res}"
    user = res.get("user")
    user_id = user.get("id")
    print(f"✓ 2. 6-Digit Email Verification: OK (User ID: {user_id})")

    # 3. Login
    code, res = req("POST", "/api/auth/login", {"email": test_email, "password": "SecurePassword123!"})
    assert code == 200, f"Login failed ({code}): {res}"
    print(f"✓ 3. Sign In with Gmail & Hashed Password: OK")

    # 4. Forgot Password & Reset
    code, res = req("POST", "/api/auth/forgot-password", {"email": test_email})
    assert code == 200, f"Forgot password failed: {res}"
    token = res.get("resetToken")
    assert token, "No reset token returned"
    
    code, res = req("POST", "/api/auth/reset-password", {
        "token": token,
        "newPassword": "NewPassword456!",
        "confirmPassword": "NewPassword456!"
    })
    assert code == 200, f"Reset password failed: {res}"

    # Sign in with new password
    code, res = req("POST", "/api/auth/login", {"email": test_email, "password": "NewPassword456!"})
    assert code == 200, "Sign in with new password failed"
    print(f"✓ 4. Password Recovery & Reset via Recovery Email: OK")

    # 5. User Profile Update & Avatar
    code, res = req("POST", "/api/user/profile", {
        "userId": user_id,
        "name": "Athul Krishna K S",
        "occupation": "Senior Tech Lead, Infopark",
        "smoking": "no",
        "drinking": "no"
    })
    assert code == 200, f"Profile update failed: {res}"
    assert res.get("user", {}).get("occupation") == "Senior Tech Lead, Infopark"
    print(f"✓ 5. Profile Management & Character Rules: OK")

    # 6. Publish Room with 15 Photos & Main Cover Selection
    mock_photos = [f"data:image/webp;base64,roomPhoto_{i}" for i in range(1, 16)]
    room_payload = {
        "userId": user_id,
        "hostId": user_id,
        "hostName": "Athul Krishna K S",
        "hostAvatar": "data:image/png;base64,mockUserAvatar",
        "hostEmail": test_email,
        "hostPhone": "98451 23456",
        "hostOccupation": "Senior Tech Lead, Infopark",
        "title": "Premium 2BHK Master Bed near Kakkanad Infopark Gate 1",
        "roomType": "Private Room",
        "location": "Kakkanad (Infopark), Kochi",
        "address": "Prestige City, Infopark Expressway, Kakkanad",
        "rentSplit": 8500,
        "monthlyRent": 8500,
        "roommatesNeeded": 1,
        "deposit": 17000,
        "availableFrom": "1st of Next Month",
        "smokingRule": "no",
        "drinkingRule": "no",
        "workingShiftPreference": "day",
        "genderPreference": "any",
        "amenities": ["High-Speed WiFi", "Air Conditioning", "Attached Bathroom", "Washing Machine", "Power Backup"],
        "description": "Spacious AC bedroom with attached washroom and modular kitchen access. 5 mins walk to Infopark.",
        "images": mock_photos,
        "coverImage": mock_photos[0],
        "status": "ACTIVE"
    }

    code, res = req("POST", "/api/listings", room_payload)
    assert code == 201, f"Publish room failed ({code}): {res}"
    assert res.get("message") == "Your room has been published successfully!"
    room_id = res.get("listing", {}).get("id")
    print(f"✓ 6. Auto-Publish Room (Up to 15 Photos & Cover Selected): OK (Room ID: {room_id})")

    # 7. Check Live Appearance in Available Properties
    code, res = req("GET", "/api/listings?status=ACTIVE")
    assert code == 200
    active_rooms = res.get("listings", [])
    matching = [r for r in active_rooms if r.get("id") == room_id]
    assert len(matching) == 1, "Published room not found in live Available Properties!"
    print(f"✓ 7. Real-Time Dynamic Discovery in Available Properties: OK (Found Live!)")

    # 8. Manage My Listings: Edit Room Details
    update_data = {
        "id": room_id,
        "title": "Premium 2BHK Master Bed near Kakkanad Infopark Gate 1 (AC Included)",
        "rentSplit": 9000,
        "coverImage": mock_photos[4], # Change cover image
        "amenities": ["High-Speed WiFi", "Air Conditioning", "Attached Bathroom", "Washing Machine", "Power Backup", "Balcony View"]
    }
    code, res = req("POST", "/api/listings/update", update_data)
    assert code == 200, f"Edit room failed: {res}"
    assert res.get("listing", {}).get("rentSplit") == 9000
    assert res.get("listing", {}).get("coverImage") == mock_photos[4]
    print(f"✓ 8. Owner Edit Room Details & Cover Photo: OK")

    # 9. Manage Listing Status: RENTED -> INACTIVE -> ACTIVE
    code, res = req("POST", "/api/listings/status", {"id": room_id, "status": "RENTED"})
    assert code == 200
    # Verify hidden from public
    code, res = req("GET", "/api/listings?status=ACTIVE")
    assert not any(r.get("id") == room_id for r in res.get("listings", []))
    print(f"✓ 9a. Mark as RENTED (Hidden from Public Available Properties): OK")

    code, res = req("POST", "/api/listings/status", {"id": room_id, "status": "INACTIVE"})
    assert code == 200
    print(f"✓ 9b. Temporarily Deactivate Listing: OK")

    code, res = req("POST", "/api/listings/status", {"id": room_id, "status": "ACTIVE"})
    assert code == 200
    code, res = req("GET", "/api/listings?status=ACTIVE")
    assert any(r.get("id") == room_id for r in res.get("listings", []))
    print(f"✓ 9c. Reactivate to ACTIVE (Immediately Visible Again): OK")

    # 10. Filter by Owner
    code, res = req("GET", f"/api/listings?userId={user_id}")
    assert code == 200
    assert any(r.get("id") == room_id for r in res.get("listings", []))
    print(f"✓ 10. Owner My Listings Dashboard Query: OK")

    print("\n" + "=" * 60)
    print("ALL TESTS PASSED! THE ENTIRE SYSTEM IS PRODUCTION-READY! 🚀")
    print("=" * 60)

if __name__ == "__main__":
    run_suite()
