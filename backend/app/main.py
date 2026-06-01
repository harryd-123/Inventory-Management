import re
from collections import defaultdict

from flask import Flask, jsonify, request
from flask_cors import CORS
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload

from .database import Base, SessionLocal, engine
from .models import Customer, Order, OrderItem, Product

Base.metadata.create_all(bind=engine)

app = Flask(__name__)
CORS(app)

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def error_response(message: str, status_code: int):
    return jsonify({"detail": message}), status_code


def product_to_dict(product: Product):
    return {
        "id": product.id,
        "name": product.name,
        "sku": product.sku,
        "price": float(product.price),
        "quantity": product.quantity,
    }


def customer_to_dict(customer: Customer):
    return {
        "id": customer.id,
        "full_name": customer.full_name,
        "email": customer.email,
        "phone": customer.phone,
    }


def order_item_to_dict(item: OrderItem):
    return {
        "id": item.id,
        "product_id": item.product_id,
        "quantity": item.quantity,
        "unit_price": float(item.unit_price),
        "line_total": float(item.line_total),
    }


def order_to_dict(order: Order):
    return {
        "id": order.id,
        "customer_id": order.customer_id,
        "total_amount": float(order.total_amount),
        "items": [order_item_to_dict(item) for item in order.items],
    }


def parse_json_body():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return None, error_response("Invalid JSON body", 400)
    return payload, None


def validate_product_payload(payload: dict, partial: bool = False):
    allowed = {"name", "sku", "price", "quantity"}
    if not partial and not allowed.issubset(payload.keys()):
        return "Missing required product fields"

    if partial and not payload:
        return "At least one field is required to update"

    for key in payload:
        if key not in allowed:
            return f"Unsupported field: {key}"

    if "name" in payload and (not isinstance(payload["name"], str) or not payload["name"].strip()):
        return "Product name is required"

    if "sku" in payload and (not isinstance(payload["sku"], str) or not payload["sku"].strip()):
        return "SKU is required"

    if "price" in payload:
        try:
            price = float(payload["price"])
        except (TypeError, ValueError):
            return "Price must be a number"
        if price <= 0:
            return "Price must be greater than 0"

    if "quantity" in payload:
        if not isinstance(payload["quantity"], int):
            return "Quantity must be an integer"
        if payload["quantity"] < 0:
            return "Quantity cannot be negative"

    return None


def validate_customer_payload(payload: dict):
    required = {"full_name", "email", "phone"}
    if not required.issubset(payload.keys()):
        return "Missing required customer fields"

    if not isinstance(payload.get("full_name"), str) or not payload["full_name"].strip():
        return "Full name is required"

    email = payload.get("email")
    if not isinstance(email, str) or not EMAIL_REGEX.match(email):
        return "Valid email is required"

    phone = payload.get("phone")
    if not isinstance(phone, str) or len(phone.strip()) < 5:
        return "Valid phone number is required"

    return None


def validate_order_payload(payload: dict):
    if "customer_id" not in payload or "items" not in payload:
        return "Missing required order fields"

    if not isinstance(payload["customer_id"], int):
        return "customer_id must be an integer"

    items = payload["items"]
    if not isinstance(items, list) or len(items) == 0:
        return "Order must contain at least one item"

    for item in items:
        if not isinstance(item, dict):
            return "Each order item must be an object"
        if "product_id" not in item or "quantity" not in item:
            return "Each order item requires product_id and quantity"
        if not isinstance(item["product_id"], int):
            return "product_id must be an integer"
        if not isinstance(item["quantity"], int) or item["quantity"] <= 0:
            return "quantity must be an integer greater than 0"

    return None


@app.get("/health")
def health_check():
    return jsonify({"status": "ok"}), 200


@app.post("/products")
def create_product():
    payload, err = parse_json_body()
    if err:
        return err

    validation_error = validate_product_payload(payload)
    if validation_error:
        return error_response(validation_error, 400)

    db = SessionLocal()
    try:
        product = Product(
            name=payload["name"].strip(),
            sku=payload["sku"].strip(),
            price=float(payload["price"]),
            quantity=payload["quantity"],
        )
        db.add(product)
        db.commit()
        db.refresh(product)
        return jsonify(product_to_dict(product)), 201
    except IntegrityError:
        db.rollback()
        return error_response("SKU already exists", 400)
    finally:
        db.close()


@app.get("/products")
def list_products():
    db = SessionLocal()
    try:
        products = db.query(Product).order_by(Product.id.desc()).all()
        return jsonify([product_to_dict(product) for product in products]), 200
    finally:
        db.close()


@app.get("/products/<int:product_id>")
def get_product(product_id: int):
    db = SessionLocal()
    try:
        product = db.get(Product, product_id)
        if not product:
            return error_response("Product not found", 404)
        return jsonify(product_to_dict(product)), 200
    finally:
        db.close()


@app.put("/products/<int:product_id>")
def update_product(product_id: int):
    payload, err = parse_json_body()
    if err:
        return err

    validation_error = validate_product_payload(payload, partial=True)
    if validation_error:
        return error_response(validation_error, 400)

    db = SessionLocal()
    try:
        product = db.get(Product, product_id)
        if not product:
            return error_response("Product not found", 404)

        if "name" in payload:
            product.name = payload["name"].strip()
        if "sku" in payload:
            product.sku = payload["sku"].strip()
        if "price" in payload:
            product.price = float(payload["price"])
        if "quantity" in payload:
            product.quantity = payload["quantity"]

        db.commit()
        db.refresh(product)
        return jsonify(product_to_dict(product)), 200
    except IntegrityError:
        db.rollback()
        return error_response("SKU already exists", 400)
    finally:
        db.close()


@app.delete("/products/<int:product_id>")
def delete_product(product_id: int):
    db = SessionLocal()
    try:
        product = db.get(Product, product_id)
        if not product:
            return error_response("Product not found", 404)

        db.delete(product)
        db.commit()
        return "", 204
    except IntegrityError:
        db.rollback()
        return error_response("Cannot delete product linked to existing orders", 400)
    finally:
        db.close()


@app.post("/customers")
def create_customer():
    payload, err = parse_json_body()
    if err:
        return err

    validation_error = validate_customer_payload(payload)
    if validation_error:
        return error_response(validation_error, 400)

    db = SessionLocal()
    try:
        customer = Customer(
            full_name=payload["full_name"].strip(),
            email=payload["email"].strip(),
            phone=payload["phone"].strip(),
        )
        db.add(customer)
        db.commit()
        db.refresh(customer)
        return jsonify(customer_to_dict(customer)), 201
    except IntegrityError:
        db.rollback()
        return error_response("Customer email already exists", 400)
    finally:
        db.close()


@app.get("/customers")
def list_customers():
    db = SessionLocal()
    try:
        customers = db.query(Customer).order_by(Customer.id.desc()).all()
        return jsonify([customer_to_dict(customer) for customer in customers]), 200
    finally:
        db.close()


@app.get("/customers/<int:customer_id>")
def get_customer(customer_id: int):
    db = SessionLocal()
    try:
        customer = db.get(Customer, customer_id)
        if not customer:
            return error_response("Customer not found", 404)
        return jsonify(customer_to_dict(customer)), 200
    finally:
        db.close()


@app.delete("/customers/<int:customer_id>")
def delete_customer(customer_id: int):
    db = SessionLocal()
    try:
        customer = db.get(Customer, customer_id)
        if not customer:
            return error_response("Customer not found", 404)

        db.delete(customer)
        db.commit()
        return "", 204
    except IntegrityError:
        db.rollback()
        return error_response("Cannot delete customer with existing orders", 400)
    finally:
        db.close()


@app.post("/orders")
def create_order():
    payload, err = parse_json_body()
    if err:
        return err

    validation_error = validate_order_payload(payload)
    if validation_error:
        return error_response(validation_error, 400)

    db = SessionLocal()
    try:
        customer = db.get(Customer, payload["customer_id"])
        if not customer:
            return error_response("Customer not found", 404)

        quantities_by_product: dict[int, int] = defaultdict(int)
        for item in payload["items"]:
            quantities_by_product[item["product_id"]] += item["quantity"]

        products = (
            db.query(Product)
            .filter(Product.id.in_(list(quantities_by_product.keys())))
            .with_for_update()
            .all()
        )
        product_map = {product.id: product for product in products}

        missing = [pid for pid in quantities_by_product if pid not in product_map]
        if missing:
            return error_response(f"Product(s) not found: {missing}", 404)

        for product_id, requested_qty in quantities_by_product.items():
            product = product_map[product_id]
            if product.quantity < requested_qty:
                return error_response(
                    f"Insufficient inventory for product SKU {product.sku}",
                    400,
                )

        order = Order(customer_id=payload["customer_id"], total_amount=0.0)
        db.add(order)
        db.flush()

        total_amount = 0.0
        for product_id, requested_qty in quantities_by_product.items():
            product = product_map[product_id]
            line_total = product.price * requested_qty
            total_amount += line_total
            product.quantity -= requested_qty

            db.add(
                OrderItem(
                    order_id=order.id,
                    product_id=product_id,
                    quantity=requested_qty,
                    unit_price=product.price,
                    line_total=line_total,
                )
            )

        order.total_amount = round(total_amount, 2)
        db.commit()

        fresh_order = (
            db.query(Order)
            .options(joinedload(Order.items))
            .filter(Order.id == order.id)
            .first()
        )
        return jsonify(order_to_dict(fresh_order)), 201
    except IntegrityError:
        db.rollback()
        return error_response("Could not create order", 400)
    finally:
        db.close()


@app.get("/orders")
def list_orders():
    db = SessionLocal()
    try:
        orders = db.query(Order).options(joinedload(Order.items)).order_by(Order.id.desc()).all()
        return jsonify([order_to_dict(order) for order in orders]), 200
    finally:
        db.close()


@app.get("/orders/<int:order_id>")
def get_order(order_id: int):
    db = SessionLocal()
    try:
        order = db.query(Order).options(joinedload(Order.items)).filter(Order.id == order_id).first()
        if not order:
            return error_response("Order not found", 404)
        return jsonify(order_to_dict(order)), 200
    finally:
        db.close()


@app.delete("/orders/<int:order_id>")
def delete_order(order_id: int):
    db = SessionLocal()
    try:
        order = db.query(Order).options(joinedload(Order.items)).filter(Order.id == order_id).first()
        if not order:
            return error_response("Order not found", 404)

        for item in order.items:
            product = db.get(Product, item.product_id)
            if product:
                product.quantity += item.quantity

        db.delete(order)
        db.commit()
        return "", 204
    finally:
        db.close()


@app.get("/dashboard")
def dashboard():
    db = SessionLocal()
    try:
        total_products = db.query(func.count(Product.id)).scalar() or 0
        total_customers = db.query(func.count(Customer.id)).scalar() or 0
        total_orders = db.query(func.count(Order.id)).scalar() or 0
        low_stock_products = db.query(func.count(Product.id)).filter(Product.quantity <= 5).scalar() or 0

        return (
            jsonify(
                {
                    "total_products": total_products,
                    "total_customers": total_customers,
                    "total_orders": total_orders,
                    "low_stock_products": low_stock_products,
                }
            ),
            200,
        )
    finally:
        db.close()
