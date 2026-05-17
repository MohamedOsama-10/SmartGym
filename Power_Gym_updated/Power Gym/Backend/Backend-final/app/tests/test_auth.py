from app.models.user import User
from app.models.customer import Customer
from app.models.coach import Coach



def test_signup_creates_coach_profile(client, db_session):
    """✅ Signup automatically creates coach profile"""
    response = client.post("/api/v1/auth/signup", json={
        "full_name": "Test Coach",
        "email": "coach@test.com",
        "password": "password123",
        "role": "COACH"
    })
    
    assert response.status_code == 201
    user_id = response.json()["id"]
    
    # Check coach profile exists
    from app.models.coach import Coach
    coach = db_session.query(Coach).filter(Coach.user_id == user_id).first()
    assert coach is not None
    assert coach.experience_years == 0  # Default value


def test_signup_creates_customer_profile(client, db_session):
    """✅ Signup automatically creates customer profile"""
    response = client.post("/api/v1/auth/signup", json={
        "full_name": "Test Customer",
        "email": "customer@test.com",
        "password": "password123",
        "role": "CUSTOMER"
    })
    
    assert response.status_code == 201
    user_id = response.json()["id"]
    
    # Check customer profile exists
    from app.models.customer import Customer
    customer = db_session.query(Customer).filter(Customer.user_id == user_id).first()
    assert customer is not None


def test_signup_success(client, db):
    response = client.post("/api/v1/auth/signup", json={
        "full_name": "John Doe",
        "email": "john@example.com",
        "password": "securepassword123",
        "role": "CUSTOMER"
    })

    assert response.status_code == 201

    data = response.json()
    assert data["email"] == "john@example.com"
    assert data["role"] == "CUSTOMER"
    assert "password" not in data

    # ✅ User exists in DB
    user = db.query(User).filter_by(email="john@example.com").first()
    assert user is not None

    # ✅ Customer profile auto-created
    customer = db.query(Customer).filter_by(user_id=user.id).first()
    assert customer is not None


def test_signup_duplicate_email(client):
    # Create first user
    client.post("/api/v1/auth/signup", json={
        "full_name": "John Doe",
        "email": "john@example.com",
        "password": "password123",
        "role": "CUSTOMER"
    })

    # Try to create duplicate
    response = client.post("/api/v1/auth/signup", json={
        "full_name": "Jane Doe",
        "email": "john@example.com",
        "password": "password456",
        "role": "COACH"
    })

    assert response.status_code == 400
    assert "already registered" in response.json()["detail"]


def test_signup_creates_coach_profile(client, db):
    response = client.post("/api/v1/auth/signup", json={
        "full_name": "Ahmed Coach",
        "email": "coach@example.com",
        "password": "password123",
        "role": "COACH"
    })

    assert response.status_code == 201

    # ✅ User exists
    user = db.query(User).filter_by(email="coach@example.com").first()
    assert user is not None
    assert user.role == "COACH"

    # ✅ Coach profile auto-created
    coach = db.query(Coach).filter_by(user_id=user.id).first()
    assert coach is not None


def test_refresh_token_works(client):
    """✅ Refresh token generates new access token"""
    # Login
    login_response = client.post("/api/v1/auth/login", json={
        "email": "test@example.com",
        "password": "password123"
    })
    
    refresh_token = login_response.json()["refresh_token"]
    
    # Use refresh token
    response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token}
    )
    
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_refresh_token_blacklisted_after_logout(client):
    """✅ Refresh token cannot be used after logout"""
    # Login
    login_response = client.post("/api/v1/auth/login", json={
        "email": "test@example.com",
        "password": "password123"
    })
    
    access_token = login_response.json()["access_token"]
    refresh_token = login_response.json()["refresh_token"]
    
    # Logout
    client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {access_token}"},
        json={"refresh_token": refresh_token}
    )
    
    # Try to use refresh token
    response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token}
    )
    
    assert response.status_code == 401


def test_cannot_book_past_date(customer_token, coach_token):
    """❌ Cannot book sessions in the past"""
    # Coach creates past availability (this should also be prevented)
    import datetime
    yesterday = datetime.date.today() - datetime.timedelta(days=1)
    
    # Try to book
    response = client.post(
        "/api/v1/bookings/",
        headers={"Authorization": f"Bearer {customer_token}"},
        json={
            "coach_id": 1,
            "availability_slot_id": 1  # Assume this is past slot
        }
    )
    
    assert response.status_code == 400
    assert "past" in response.json()["detail"].lower()


def test_customer_cannot_double_book_different_coaches(customer_token, coach_token):
    """❌ Customer cannot book same time with different coaches"""
    # Coach 1 creates availability
    slot1 = client.post(
        "/api/v1/coach/availability/",
        headers={"Authorization": f"Bearer {coach_token}"},
        json={
            "date": "2026-02-10",
            "start_time": "09:00:00",
            "end_time": "10:00:00"
        }
    )
    
    # Coach 2 creates availability (same time)
    # ... (create another coach and slot)
    
    # Customer books coach 1
    client.post(
        "/api/v1/bookings/",
        headers={"Authorization": f"Bearer {customer_token}"},
        json={"coach_id": 1, "availability_slot_id": slot1.json()["id"]}
    )
    
    # Try to book coach 2 at same time
    response = client.post(
        "/api/v1/bookings/",
        headers={"Authorization": f"Bearer {customer_token}"},
        json={"coach_id": 2, "availability_slot_id": slot2_id}
    )
    
    assert response.status_code == 400
    assert "already have a booking" in response.json()["detail"]


def test_cannot_confirm_cancelled_booking(coach_token):
    """❌ Coach cannot confirm cancelled booking"""
    # Create and cancel booking
    # ... (create booking, customer cancels it)
    
    # Try to confirm
    response = client.put(
        f"/api/v1/bookings/{booking_id}/confirm",
        headers={"Authorization": f"Bearer {coach_token}"}
    )
    
    assert response.status_code == 400
    assert "cancelled" in response.json()["detail"].lower()