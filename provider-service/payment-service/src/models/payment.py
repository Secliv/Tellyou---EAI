from sqlalchemy import Column, Integer, Float, String, DateTime
from sqlalchemy.sql import func
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, nullable=False, index=True)
    amount = Column(Float, nullable=False)
    payment_status = Column(String(20), nullable=False)
    payment_date = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<Payment id={self.id} order_id={self.order_id} status={self.payment_status}>"
