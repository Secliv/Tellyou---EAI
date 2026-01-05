import graphene
from sqlalchemy.orm import Session

from src.services.payment_service import PaymentService
from src.config.database import SessionLocal
from src.graphql.schema import Payment, PaymentStatus

# HELPER: GET DB SESSION
def get_db_session() -> Session:
    db = SessionLocal()
    try:
        return db
    finally:
        pass

# QUERY RESOLVERS
class QueryResolvers:

    def resolve_payment_status(self, info, id):
        db = get_db_session()
        service = PaymentService(db)
        payment = service.get_payment_by_id(int(id))
        db.close()
        return payment

    def resolve_payments(self, info, order_id=None):
        db = get_db_session()
        service = PaymentService(db)
        payments = service.get_payments(
            order_id=int(order_id) if order_id else None
        )
        db.close()
        return payments

# MUTATION RESOLVERS
class ConfirmPayment(graphene.Mutation):
    class Arguments:
        order_id = graphene.ID(required=True)
        amount = graphene.Float(required=True)

    Output = Payment

    def mutate(self, info, order_id, amount):
        db = get_db_session()
        service = PaymentService(db)
        payment = service.confirm_payment(
            order_id=int(order_id),
            amount=amount
        )
        db.close()
        return payment


class UpdatePaymentStatus(graphene.Mutation):
    class Arguments:
        id = graphene.ID(required=True)
        status = PaymentStatus(required=True)

    Output = Payment

    def mutate(self, info, id, status):
        db = get_db_session()
        service = PaymentService(db)
        payment = service.update_payment_status(
            payment_id=int(id),
            status=status.value
        )
        db.close()
        return payment
