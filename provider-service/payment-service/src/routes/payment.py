from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from src.services.payment_service import PaymentService
from src.config.database import get_db

router = APIRouter(prefix="", tags=["Payment"])

# REQUEST SCHEMA
class PaymentRequest(BaseModel):
    order_id: int
    amount: float

# RESPONSE SCHEMA
class PaymentResponse(BaseModel):
    id: int
    order_id: int
    amount: float
    payment_status: str

# POST /payment
@router.post("/payment", response_model=PaymentResponse)
def confirm_payment(
    payload: PaymentRequest,
    db: Session = Depends(get_db)
):
    service = PaymentService(db)
    payment = service.confirm_payment(
        order_id=payload.order_id,
        amount=payload.amount
    )

    return payment

# GET /payment-status
@router.get("/payment-status", response_model=PaymentResponse)
def get_payment_status(
    id: int = Query(..., description="Payment ID"),
    db: Session = Depends(get_db)
):
    service = PaymentService(db)
    payment = service.get_payment_by_id(id)

    if not payment:
        raise HTTPException(
            status_code=404,
            detail="Payment not found"
        )

    return payment
