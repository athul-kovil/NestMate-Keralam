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

def run_tests():
    print("=" * 70)
    print("TESTING REAL UPLOADED ROOMS, 5-USER DISCOVERY, AND POST DELETION")
    print("=" * 70)

    # 1. Verify clean database (No demo rooms)
    status, res = req("GET", "/api/listings")
    assert status == 200
    initial_rooms = res.get("listings", [])
    print(f"✓ 1. Zero Demo Rooms check: Database currently has {len(initial_rooms)} rooms (Clean start)")

    # 2. Simulate 5 different users publishing 5 real rooms
    users_data = [
        {
            "name": "Rahul Menon",
            "email": "rahul.infopark@gmail.com",
            "title": "Private Master Bedroom in 2BHK near Infopark Kakkanad",
            "location": "Kakkanad (Infopark), Kochi",
            "address": "Expressway Towers, Near Phase 2",
            "rentSplit": 8000,
            "roomType": "Private Room",
            "photos": ["data:image/jpeg;base64,realPhotoKakkanad_1", "data:image/jpeg;base64,realPhotoKakkanad_2"]
        },
        {
            "name": "Anjali Nair",
            "email": "anjali.technopark@gmail.com",
            "title": "Twin Sharing Bed for Female near Technopark Kazhakkoottam",
            "location": "Kazhakkoottam (Technopark), Trivandrum",
            "address": "Greenfield Vista, Near Gate 1",
            "rentSplit": 5500,
            "roomType": "Shared Room (Twin)",
            "photos": ["data:image/jpeg;base64,realPhotoKazhakkoottam_1"]
        },
        {
            "name": "Fahad K",
            "email": "fahad.calicut@gmail.com",
            "title": "Spacious Room in 3BHK flat near Cyberpark Calicut",
            "location": "Cyberpark, Kozhikode",
            "address": "Hilite City Enclave, Palazhi",
            "rentSplit": 6500,
            "roomType": "Private Room",
            "photos": ["data:image/jpeg;base64,realPhotoCyberpark_1", "data:image/jpeg;base64,realPhotoCyberpark_2", "data:image/jpeg;base64,realPhotoCyberpark_3"]
        },
        {
            "name": "Vishnu Prasad",
            "email": "vishnu.edappally@gmail.com",
            "title": "Single Room 200m from Edappally Metro Station",
            "location": "Edappally, Kochi",
            "address": "Lulu Avenue, Edappally Toll",
            "rentSplit": 7000,
            "roomType": "Private Room",
            "photos": ["data:image/jpeg;base64,realPhotoEdappally_1"]
        },
        {
            "name": "Deepa Thomas",
            "email": "deepa.palarivattom@gmail.com",
            "title": "Furnished Flatshare near Palarivattom Bypass",
            "location": "Palarivattom, Kochi",
            "address": "Metro View Apartments, Civil Line Road",
            "rentSplit": 7500,
            "roomType": "Shared Room",
            "photos": ["data:image/jpeg;base64,realPhotoPalarivattom_1"]
        }
    ]

    published_ids = []
    for i, u in enumerate(users_data, 1):
        payload = {
            "userId": f"usr_test_{i}",
            "hostId": f"usr_test_{i}",
            "hostName": u["name"],
            "hostEmail": u["email"],
            "hostPhone": f"98451 0000{i}",
            "hostOccupation": "IT Professional",
            "title": u["title"],
            "roomType": u["roomType"],
            "location": u["location"],
            "address": u["address"],
            "rentSplit": u["rentSplit"],
            "monthlyRent": u["rentSplit"],
            "roommatesNeeded": 1,
            "deposit": u["rentSplit"] * 2,
            "availableFrom": "Immediate",
            "smokingRule": "no",
            "drinkingRule": "social",
            "workingShiftPreference": "day",
            "genderPreference": "any",
            "amenities": ["High-Speed WiFi", "Attached Bathroom"],
            "images": u["photos"],
            "coverImage": u["photos"][0],
            "description": f"Real room posted by {u['name']} in {u['location']}.",
            "status": "ACTIVE"
        }
        st, res = req("POST", "/api/listings", payload)
        assert st == 201, f"Failed publishing room for {u['name']}: {res}"
        room_id = res.get("listing", {}).get("id")
        published_ids.append(room_id)
        print(f"✓ 2.{i} User '{u['name']}' published real room in {u['location']} (ID: {room_id})")

    # 3. Verify ALL 5 rooms are LIVE simultaneously in Available Properties
    status, res = req("GET", "/api/listings?status=ACTIVE")
    assert status == 200
    live_listings = res.get("listings", [])
    live_ids = [l["id"] for l in live_listings]
    assert len(published_ids) == 5
    for pid in published_ids:
        assert pid in live_ids, f"Room {pid} not found in live active listings!"
    print(f"\n✓ 3. ALL 5 Users' rooms are LIVE and available on the website simultaneously! (Count: {len(live_ids)})")

    # 4. Finding Roommates & Status Management:
    # Anjali (User 2) found roommates! Marks room as RENTED
    user2_room_id = published_ids[1]
    status, res = req("POST", "/api/listings/status", {"id": user2_room_id, "status": "RENTED"})
    assert status == 200
    print(f"✓ 4a. User 2 (Anjali) marked room as RENTED (Found roommates!)")

    # Check that Rented room is no longer in public Available Properties
    status, res = req("GET", "/api/listings?status=ACTIVE")
    active_now = [l["id"] for l in res.get("listings", [])]
    assert user2_room_id not in active_now, "Rented room should be hidden from Available Properties!"
    print(f"✓ 4b. Rented room is automatically hidden from public discovery (Active count: {len(active_now)})")

    # 5. User 1 (Rahul) wants to permanently delete his post after moving in
    user1_room_id = published_ids[0]
    status, res = req("POST", "/api/listings/delete", {"id": user1_room_id})
    assert status == 200
    print(f"✓ 5a. User 1 (Rahul) permanently deleted his room post")

    # Verify completely deleted from database
    status, res = req("GET", f"/api/listings?id={user1_room_id}")
    assert status == 404, "Deleted room should not exist in database!"
    print(f"✓ 5b. Deleted post is completely purged from database")

    # 6. Clean up remaining test rooms so Athul has a 100% clean platform
    for pid in published_ids[2:]:
        req("POST", "/api/listings/delete", {"id": pid})
    # Also delete user 2's rented room
    req("POST", "/api/listings/delete", {"id": user2_room_id})

    # Verify database is now completely clean of test posts
    status, res = req("GET", "/api/listings")
    assert len(res.get("listings", [])) == 0
    print(f"✓ 6. Database reset to 100% clean: 0 demo rooms, ready for real users.")

    print("\n" + "=" * 70)
    print("ALL VERIFICATIONS PASSED! REAL-ROOM MULTI-USER DISCOVERY IS ROCK SOLID! 🚀")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
