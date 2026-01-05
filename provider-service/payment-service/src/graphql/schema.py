import graphene
from graphene import ObjectType, Field, List, ID, Float, Enum
from src.services.payment_service import PaymentService
from src.config.database import SessionLocal

# ENUM
class PaymentStatus(Enum):
    PENDING = "PENDING"
    PAID = "PAID"
    FAILED = "FAILED"

# TYPE
class Payment(graphene.ObjectType):
    id = ID()
    order_id = ID()
    amount = Float()
    payment_status = PaymentStatus()

# QUERY
class Query(ObjectType):
    payment_status = Field(Payment, id=ID(required=True))
    payments = List(Payment, order_id=ID())

    def resolve_payment_status(self, info, id):
        db = SessionLocal()
        service = PaymentService(db)
        result = service.get_payment_by_id(int(id))
        db.close()
        return result

    def resolve_payments(self, info, order_id=None):
        db = SessionLocal()
        service = PaymentService(db)
        result = service.get_payments(order_id)
        db.close()
        return result

# MUTATION
class ConfirmPayment(graphene.Mutation):
    class Arguments:
        order_id = ID(required=True)
        amount = Float(required=True)

    Output = Payment

    def mutate(self, info, order_id, amount):
        db = SessionLocal()
        service = PaymentService(db)
        payment = service.confirm_payment(
            order_id=int(order_id),
            amount=amount
        )
        db.close()
        return payment


class UpdatePaymentStatus(graphene.Mutation):
    class Arguments:
        id = ID(required=True)
        status = PaymentStatus(required=True)

    Output = Payment

    def mutate(self, info, id, status):
        db = SessionLocal()
        service = PaymentService(db)
        payment = service.update_payment_status(
            payment_id=int(id),
            status=status.value
        )
        db.close()
        return payment


class Mutation(ObjectType):
    confirm_payment = ConfirmPayment.Field()
    update_payment_status = UpdatePaymentStatus.Field()


schema = graphene.Schema(query=Query, mutation=Mutation)
