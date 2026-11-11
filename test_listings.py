import urllib.request
import urllib.parse
import json
import sys

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

BASE_URL = "http://localhost:8000"

def request(method, path, data=None):
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, method=method)
    if data is not None:
        req.add_header("Content-Type", "application/json")
        encoded = json.dumps(data).encode("utf-8")
        req.data = encoded
    try:
        with urllib.request.urlopen(req) as resp:
            body = resp.read().decode("utf-8")
            return resp.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        return e.code, json.loads(body) if body else {}

def run_tests():
    print("Testing Listings & Airbnb Room Discovery System...")

    # 1. GET /api/listings
    status, res = request("GET", "/api/listings")
    assert status == 200, f"Expected 200, got {status}: {res}"
    print(f"✓ GET /api/listings works. Count: {len(res.get('listings', []))}")

    # 2. Publish New Room Listing
    mock_images = [f"data:image/png;base64,mockImage{i}" for i in range(1, 16)] # 15 photos
    listing_payload = {
        "title": "Luxury 1 BHK Near Infopark Expressway Kakkanad",
        "roomType": "Private Room",
        "location": "Kakkanad (Infopark), Kochi",
        "address": "Olive Heights, Near Carnival Infopark Phase 1",
        "rentSplit": 7500,
        "monthlyRent": 7500,
        "roommatesNeeded": 1,
        "deposit": 15000,
        "availableFrom": "Immediate",
        "smokingRule": "no",
        "drinkingRule": "social",
        "workingShiftPreference": "day",
        "genderPreference": "any",
        "amenities": ["High-Speed WiFi", "Air Conditioning", "Attached Bathroom", "Washing Machine"],
        "description": "Spacious flat with balcony overlooking Infopark. Looking for IT professional roommate.",
        "images": mock_images,
        "coverImage": mock_images[2], # Pick 3rd image as cover
        "hostId": "usr_1794389893505",
        "hostName": "Athul Krishna",
        "hostEmail": "sachuathul31@gmail.com",
        "hostPhone": "98451 23456",
        "hostOccupation": "Software Engineer"
    }

    status, res = request("POST", "/api/listings", listing_payload)
    assert status == 201, f"Expected 201, got {status}: {res}"
    assert res.get("message") == "Your room has been published successfully!", f"Unexpected message: {res.get('message')}"
    created_listing = res.get("listing", {})
    listing_id = created_listing.get("id")
    assert created_listing.get("status") == "ACTIVE", f"Expected ACTIVE status, got {created_listing.get('status')}"
    assert len(created_listing.get("images", [])) == 15, f"Expected 15 images, got {len(created_listing.get('images', []))}"
    assert created_listing.get("coverImage") == mock_images[2], "Cover image mismatch"
    print(f"✓ POST /api/listings publishes room successfully (ID: {listing_id}, Status: ACTIVE, 15 photos, cover set)")

    # 3. GET /api/listings should now include this listing
    status, res = request("GET", "/api/listings?status=ACTIVE")
    assert status == 200, f"Expected 200, got {status}: {res}"
    active_ids = [l["id"] for l in res.get("listings", [])]
    assert listing_id in active_ids, f"Published listing {listing_id} not found in ACTIVE listings: {active_ids}"
    print(f"✓ GET /api/listings?status=ACTIVE shows newly published room live dynamically")

    # 4. Update Room Listing
    update_payload = {
        "id": listing_id,
        "title": "Luxury 1 BHK Near Infopark Expressway Kakkanad (Furnished)",
        "rentSplit": 8000,
        "coverImage": mock_images[0], # change cover photo
        "amenities": ["High-Speed WiFi", "Air Conditioning", "Attached Bathroom", "Modular Kitchen"]
    }
    status, res = request("POST", "/api/listings/update", update_payload)
    assert status == 200, f"Expected 200, got {status}: {res}"
    updated = res.get("listing", {})
    assert updated.get("title") == update_payload["title"], "Title update failed"
    assert updated.get("rentSplit") == 8000, "Rent update failed"
    assert updated.get("coverImage") == mock_images[0], "Cover image change failed"
    print("✓ POST /api/listings/update successfully updated details and cover image")

    # 5. Mark as Rented
    status, res = request("POST", "/api/listings/status", {"id": listing_id, "status": "RENTED"})
    assert status == 200, f"Expected 200, got {status}: {res}"
    assert res.get("listing", {}).get("status") == "RENTED"
    print("✓ POST /api/listings/status marked listing as RENTED")

    # 6. Verify Rented listing is hidden from Available Properties (status=ACTIVE)
    status, res = request("GET", "/api/listings?status=ACTIVE")
    active_ids = [l["id"] for l in res.get("listings", [])]
    assert listing_id not in active_ids, f"Rented listing {listing_id} should not appear in ACTIVE listings"
    print("✓ Rented room is automatically hidden from Available Properties")

    # 7. Reactivate to ACTIVE
    status, res = request("POST", "/api/listings/status", {"id": listing_id, "status": "ACTIVE"})
    assert status == 200, f"Expected 200, got {status}: {res}"
    assert res.get("listing", {}).get("status") == "ACTIVE"
    print("✓ POST /api/listings/status reactivated listing to ACTIVE")

    # 8. Filter by User ID (Manage My Listings)
    status, res = request("GET", f"/api/listings?userId=usr_1794389893505")
    assert status == 200, f"Expected 200, got {status}: {res}"
    user_listings = res.get("listings", [])
    assert any(l["id"] == listing_id for l in user_listings), "Listing not found in My Listings"
    print(f"✓ GET /api/listings?userId=... returns owner's listings for My Listings management")

    # 9. Temporarily Deactivate
    status, res = request("POST", "/api/listings/status", {"id": listing_id, "status": "INACTIVE"})
    assert status == 200, f"Expected 200, got {status}: {res}"
    status, res = request("GET", "/api/listings?status=ACTIVE")
    assert listing_id not in [l["id"] for l in res.get("listings", [])]
    print("✓ Status INACTIVE hides room from Available Properties")

    # 10. Reactivate and keep one clean live room for Kerala demonstration
    status, res = request("POST", "/api/listings/status", {"id": listing_id, "status": "ACTIVE"})
    assert status == 200, f"Expected 200, got {status}: {res}"
    print("✓ Room reactivated to ACTIVE for live discovery")

    print("\nALL 10 LISTING SYSTEM TESTS PASSED SUCCESSFULLY! 🎉")

if __name__ == "__main__":
    run_tests()
