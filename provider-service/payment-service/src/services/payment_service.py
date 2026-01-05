from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional

from src.models.payment import Payment


class PaymentService:
    def __init__(self, db: Session):
        self.db = db

    # CREATE / CONFIRM PAYMENT
    def confirm_payment(self, order_id: int, amount: float) -> Payment:
        payment = Payment(
            order_id=order_id,
            amount=amount,
            payment_status="PAID",
            payment_date=datetime.utcnow()
        )

        self.db.add(payment)
        self.db.commit()
        self.db.refresh(payment)

        return payment

    # GET PAYMENT BY ID
    def get_payment_by_id(self, payment_id: int) -> Optional[Payment]:
        return (
            self.db
            .query(Payment)
            .filter(Payment.id == payment_id)
            .first()
        )

    # GET PAYMENTS ALL
    def get_payments(self, order_id: Optional[int] = None) -> List[Payment]:
        query = self.db.query(Payment)

        if order_id is not None:
            query = query.filter(Payment.order_id == order_id)

        return query.all()

    # UPDATE PAYMENT STATUS
    def update_payment_status(self, payment_id: int, status: str) -> Optional[Payment]:
        payment = self.get_payment_by_id(payment_id)

        if not payment:
            return None

        payment.payment_status = status
        self.db.commit()
        self.db.refresh(payment)

        return payment
