from fastapi import FastAPI
from starlette_graphene3 import GraphQLApp

from src.graphql.schema import schema
from src.routes.payment import router as payment_router

app = FastAPI(
    title="Payment Processing Service",
    version="1.0.0"
)

# REST ROUTES
app.include_router(payment_router)

# GRAPHQL ENDPOINT
app.add_route("/graphql", GraphQLApp(schema=schema))


# HEALTH CHECK
@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "payment-service"
    }
