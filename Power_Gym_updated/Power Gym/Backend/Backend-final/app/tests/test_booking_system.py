import pytest
from fastapi.testclient import TestClient
from datetime import date, time, datetime, timedelta
from app.main import app

client = TestClient(app)

# ==================== FIXTURES ====================

@pytest.fixture
def owner_token():
    """Create and login as OWNER"""
    # Signup
    client.post("/api/v1/auth/signup", json={
        "full_name": "Owner User",
        "email": "owner@test.com",
        "password": "password123",
        "role": "OWNER"
    })
    # Login
    response = client.post("/api/v1/auth/login", json={
        "email": "owner@test.com",
        "password": "password123"
    })
    return response.json()["access_token"]


@pytest.fixture
def coach_token(db_session):
    """Create and login as COACH"""
    # Signup
    signup_response = client.post("/api/v1/auth/signup", json={
        "full_name": "Coach User",
        "email": "coach@test.com",
        "password": "password123",
        "role": "COACH"
    })
    user_id = signup_response.json()["id"]
    
    # Create coach profile in database
    from app.models.coach import Coach
    coach = Coach(user_id=user_id, experience_years=5, hourly_rate=50.0)
    db_session.add(coach)
    db_session.commit()
    
    # Login
    response = client.post("/api/v1/auth/login", json={
        "email": "coach@test.com",
        "password": "password123"
    })
    return response.json()["access_token"]


@pytest.fixture
def customer_token(db_session):
    """Create and login as CUSTOMER"""
    # Signup
    signup_response = client.post("/api/v1/auth/signup", json={
        "full_name": "Customer User",
        "email": "customer@test.com",
        "password": "password123",
        "role": "CUSTOMER"
    })
    user_id = signup_response.json()["id"]
    
    # Create customer profile in database
    from app.models.customer import Customer
    customer = Customer(user_id=user_id, height=175.0, weight=70.0)
    db_session.add(customer)
    db_session.commit()
    
    # Login
    response = client.post("/api/v1/auth/login", json={
        "email": "customer@test.com",
        "password": "password123"
    })
    return response.json()["access_token"]


# ==================== AUTHORIZATION TESTS ====================

def test_customer_cannot_create_availability(customer_token):
    """❌ Customer cannot create coach availability"""
    response = client.post(
        "/api/v1/coach/availability/",
        headers={"Authorization": f"Bearer {customer_token}"},
        json={
            "date": str(date.today() + timedelta(days=1)),
            "start_time": "09:00:00",
            "end_time": "10:00:00"
        }
    )
    assert response.status_code == 403
    assert "Only coaches" in response.json()["detail"]


def test_coach_cannot_create_booking(coach_token):
    """❌ Coach cannot create bookings (customers only)"""
    response = client.post(
        "/api/v1/bookings/",
        headers={"Authorization": f"Bearer {coach_token}"},
        json={
            "coach_id": 1,
            "availability_slot_id": 1
        }
    )
    assert response.status_code == 403
    assert "Only customers" in response.json()["detail"]


def test_customer_cannot_view_all_bookings(customer_token):
    """❌ Customer cannot view all bookings (owner only)"""
    response = client.get(
        "/api/v1/bookings/all",
        headers={"Authorization": f"Bearer {customer_token}"}
    )
    assert response.status_code == 403
    assert "Only owners" in response.json()["detail"]


def test_owner_can_view_all_bookings(owner_token):
    """✅ Owner can view all bookings"""
    response = client.get(
        "/api/v1/bookings/all",
        headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_unauthenticated_user_rejected():
    """❌ Unauthenticated requests are rejected"""
    response = client.get("/api/v1/bookings/my-bookings")
    assert response.status_code == 401


# ==================== COACH AVAILABILITY TESTS ====================

def test_coach_can_create_availability(coach_token):
    """✅ Coach can create availability slot"""
    tomorrow = date.today() + timedelta(days=1)
    response = client.post(
        "/api/v1/coach/availability/",
        headers={"Authorization": f"Bearer {coach_token}"},
        json={
            "date": str(tomorrow),
            "start_time": "09:00:00",
            "end_time": "10:00:00"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["date"] == str(tomorrow)
    assert data["is_available"] == True


def test_coach_cannot_create_overlapping_slots(coach_token):
    """❌ Coach cannot create overlapping time slots"""
    tomorrow = date.today() + timedelta(days=2)
    
    # Create first slot
    client.post(
        "/api/v1/coach/availability/",
        headers={"Authorization": f"Bearer {coach_token}"},
        json={
            "date": str(tomorrow),
            "start_time": "09:00:00",
            "end_time": "11:00:00"
        }
    )
    
    # Try to create overlapping slot
    response = client.post(
        "/api/v1/coach/availability/",
        headers={"Authorization": f"Bearer {coach_token}"},
        json={
            "date": str(tomorrow),
            "start_time": "10:00:00",
            "end_time": "12:00:00"
        }
    )
    assert response.status_code == 400
    assert "overlaps" in response.json()["detail"].lower()


def test_coach_can_view_own_availability(coach_token):
    """✅ Coach can view their own availability"""
    response = client.get(
        "/api/v1/coach/availability/",
        headers={"Authorization": f"Bearer {coach_token}"}
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_coach_can_delete_availability_without_bookings(coach_token, db_session):
    """✅ Coach can delete slot without bookings"""
    # Create slot
    tomorrow = date.today() + timedelta(days=3)
    create_response = client.post(
        "/api/v1/coach/availability/",
        headers={"Authorization": f"Bearer {coach_token}"},
        json={
            "date": str(tomorrow),
            "start_time": "14:00:00",
            "end_time": "15:00:00"
        }
    )
    slot_id = create_response.json()["id"]
    
    # Delete slot
    response = client.delete(
        f"/api/v1/coach/availability/{slot_id}",
        headers={"Authorization": f"Bearer {coach_token}"}
    )
    assert response.status_code == 204


# ==================== BOOKING TESTS ====================

def test_customer_can_create_booking(customer_token, coach_token, db_session):
    """✅ Customer can create booking"""
    # Coach creates availability
    tomorrow = date.today() + timedelta(days=5)
    slot_response = client.post(
        "/api/v1/coach/availability/",
        headers={"Authorization": f"Bearer {coach_token}"},
        json={
            "date": str(tomorrow),
            "start_time": "09:00:00",
            "end_time": "10:00:00"
        }
    )
    slot_id = slot_response.json()["id"]
    
    # Get coach_id from database
    from app.models.coach import Coach
    from app.models.user import User
    coach_user = db_session.query(User).filter(User.email == "coach@test.com").first()
    coach = db_session.query(Coach).filter(Coach.user_id == coach_user.id).first()
    
    # Customer creates booking
    response = client.post(
        "/api/v1/bookings/",
        headers={"Authorization": f"Bearer {customer_token}"},
        json={
            "coach_id": coach.id,
            "availability_slot_id": slot_id,
            "customer_notes": "First session"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "PENDING"
    assert data["customer_notes"] == "First session"


def test_customer_cannot_double_book(customer_token, coach_token, db_session):
    """❌ Customer cannot book same time slot twice"""
    # Setup availability
    tomorrow = date.today() + timedelta(days=6)
    slot_response = client.post(
        "/api/v1/coach/availability/",
        headers={"Authorization": f"Bearer {coach_token}"},
        json={
            "date": str(tomorrow),
            "start_time": "11:00:00",
            "end_time": "12:00:00"
        }
    )
    slot_id = slot_response.json()["id"]
    
    from app.models.coach import Coach
    from app.models.user import User
    coach_user = db_session.query(User).filter(User.email == "coach@test.com").first()
    coach = db_session.query(Coach).filter(Coach.user_id == coach_user.id).first()
    
    # First booking - success
    client.post(
        "/api/v1/bookings/",
        headers={"Authorization": f"Bearer {customer_token}"},
        json={
            "coach_id": coach.id,
            "availability_slot_id": slot_id
        }
    )
    
    # Second booking - should fail
    response = client.post(
        "/api/v1/bookings/",
        headers={"Authorization": f"Bearer {customer_token}"},
        json={
            "coach_id": coach.id,
            "availability_slot_id": slot_id
        }
    )
    assert response.status_code == 400
    assert "already booked" in response.json()["detail"].lower()


def test_customer_can_cancel_own_booking(customer_token, coach_token, db_session):
    """✅ Customer can cancel their own booking"""
    # Create booking
    tomorrow = date.today() + timedelta(days=7)
    slot_response = client.post(
        "/api/v1/coach/availability/",
        headers={"Authorization": f"Bearer {coach_token}"},
        json={
            "date": str(tomorrow),
            "start_time": "13:00:00",
            "end_time": "14:00:00"
        }
    )
    slot_id = slot_response.json()["id"]
    
    from app.models.coach import Coach
    from app.models.user import User
    coach_user = db_session.query(User).filter(User.email == "coach@test.com").first()
    coach = db_session.query(Coach).filter(Coach.user_id == coach_user.id).first()
    
    booking_response = client.post(
        "/api/v1/bookings/",
        headers={"Authorization": f"Bearer {customer_token}"},
        json={
            "coach_id": coach.id,
            "availability_slot_id": slot_id
        }
    )
    booking_id = booking_response.json()["id"]
    
    # Cancel booking
    response = client.put(
        f"/api/v1/bookings/{booking_id}/cancel",
        headers={"Authorization": f"Bearer {customer_token}"}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "CANCELLED"


def test_coach_can_confirm_booking(customer_token, coach_token, db_session):
    """✅ Coach can confirm pending booking"""
    # Create booking
    tomorrow = date.today() + timedelta(days=8)
    slot_response = client.post(
        "/api/v1/coach/availability/",
        headers={"Authorization": f"Bearer {coach_token}"},
        json={
            "date": str(tomorrow),
            "start_time": "15:00:00",
            "end_time": "16:00:00"
        }
    )
    slot_id = slot_response.json()["id"]
    
    from app.models.coach import Coach
    from app.models.user import User
    coach_user = db_session.query(User).filter(User.email == "coach@test.com").first()
    coach = db_session.query(Coach).filter(Coach.user_id == coach_user.id).first()
    
    booking_response = client.post(
        "/api/v1/bookings/",
        headers={"Authorization": f"Bearer {customer_token}"},
        json={
            "coach_id": coach.id,
            "availability_slot_id": slot_id
        }
    )
    booking_id = booking_response.json()["id"]
    
    # Coach confirms
    response = client.put(
        f"/api/v1/bookings/{booking_id}/confirm",
        headers={"Authorization": f"Bearer {coach_token}"}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "CONFIRMED"


def test_coach_can_complete_confirmed_booking(customer_token, coach_token, db_session):
    """✅ Coach can mark confirmed booking as completed"""
    # Create and confirm booking
    tomorrow = date.today() + timedelta(days=9)
    slot_response = client.post(
        "/api/v1/coach/availability/",
        headers={"Authorization": f"Bearer {coach_token}"},
        json={
            "date": str(tomorrow),
            "start_time": "16:00:00",
            "end_time": "17:00:00"
        }
    )
    slot_id = slot_response.json()["id"]
    
    from app.models.coach import Coach
    from app.models.user import User
    coach_user = db_session.query(User).filter(User.email == "coach@test.com").first()
    coach = db_session.query(Coach).filter(Coach.user_id == coach_user.id).first()
    
    booking_response = client.post(
        "/api/v1/bookings/",
        headers={"Authorization": f"Bearer {customer_token}"},
        json={
            "coach_id": coach.id,
            "availability_slot_id": slot_id
        }
    )
    booking_id = booking_response.json()["id"]
    
    # Confirm
    client.put(
        f"/api/v1/bookings/{booking_id}/confirm",
        headers={"Authorization": f"Bearer {coach_token}"}
    )
    
    # Complete
    response = client.put(
        f"/api/v1/bookings/{booking_id}/complete",
        headers={"Authorization": f"Bearer {coach_token}"}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "COMPLETED"


# ==================== SUMMARY ====================
"""
Test Coverage:
✅ Authorization: Role-based access control
✅ Coach Availability: Create, view, delete
✅ Booking Creation: Customer only
✅ Double Booking Prevention
✅ Booking Cancellation: Customer can cancel
✅ Booking Confirmation: Coach can confirm
✅ Booking Completion: Coach can complete
✅ Owner Permissions: Can view all bookings
❌ Unauthorized Access: Properly rejected
"""