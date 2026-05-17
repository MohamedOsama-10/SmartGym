from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.user import User
from app.models.admin import Admin
from app.models.owner import Owner
from app.models.gym import Gym


def backfill_profiles():
    db: Session = SessionLocal()

    try:
        # =========================
        # BACKFILL OWNERS + GYMS
        # =========================
        owner_users = db.query(User).filter(User.role == "owner").all()

        for user in owner_users:
            # Create owner profile if missing
            if not user.owner_profile:
                owner_profile = Owner(
                    user_id=user.id,
                    company_name="My Gym Company"
                )
                db.add(owner_profile)
                db.flush()  # Get owner_profile.id without full commit
                print(f"Created owner profile for {user.email}")

            # Ensure owner has at least one gym
            existing_gym = db.query(Gym).filter(Gym.owner_id == user.id).first()
            if not existing_gym:
                gym = Gym(
                    name=f"{user.full_name}'s Gym",
                    location="Main Branch",
                    owner_id=user.id
                )
                db.add(gym)
                db.flush()
                print(f"Created gym for owner {user.email}")

        # =========================
        # BACKFILL ADMINS
        # =========================
        admin_users = db.query(User).filter(User.role == "admin").all()

        # Attach admins to first available gym
        default_gym = db.query(Gym).first()

        for user in admin_users:
            if not user.admin_profile:
                if not default_gym:
                    raise Exception("No gym exists. Cannot create admin without gym.")

                admin_profile = Admin(
                    user_id=user.id,
                    gym_id=default_gym.id,
                    department="General",
                    is_super_admin=False
                )

                db.add(admin_profile)
                print(f"Created admin profile for {user.email}")

        db.commit()
        print("Backfill complete!")

    except Exception as e:
        db.rollback()
        print(f"Error during backfill: {e}")

    finally:
        db.close()


if __name__ == "__main__":
    backfill_profiles()
