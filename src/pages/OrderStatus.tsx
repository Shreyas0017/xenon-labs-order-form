import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  collection,
  getDocs,
  query,
  where,
  type DocumentData,
} from "firebase/firestore/lite";
import { Button } from "@/components/ui/button";
import OrderForm from "@/components/OrderForm";
import { auth, db, signOutUser } from "@/lib/firebase";

type OrderRecord = {
  id: string;
  orderNumber: string;
  total: number;
  status: string;
  createdAt?: Date;
  items: {
    productName: string;
    quantityLabel: string;
    total: number;
  }[];
};

const asDate = (value: unknown): Date | undefined => {
  if (!value) return undefined;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const maybeTimestamp = value as { toDate: () => Date };
    return maybeTimestamp.toDate();
  }
  return undefined;
};

const formatOrderNumber = (index: number): string => {
  return `ORD-${String(index + 1).padStart(4, "0")}`;
};

const parseOrderItems = (value: unknown): OrderRecord["items"] => {
  if (!Array.isArray(value)) return [];

  return value.map((item) => {
    const data = (item ?? {}) as Record<string, unknown>;
    const selectionType = typeof data.selectionType === "string" ? data.selectionType : "preset";
    const customQty = typeof data.customQty === "number" ? data.customQty : null;
    const presetKey = typeof data.presetKey === "string" ? data.presetKey : "";

    return {
      productName: typeof data.productName === "string" ? data.productName : "Unknown Product",
      quantityLabel:
        selectionType === "custom"
          ? `${customQty ?? 0} pcs`
          : presetKey || "Preset quantity",
      total: typeof data.total === "number" ? data.total : Number(data.total ?? 0),
    };
  });
};

const deriveUserName = (user: User | null): string => {
  if (!user) return "";
  if (user.displayName?.trim()) return user.displayName.trim();

  const email = user.email ?? "";
  const localPart = email.split("@")[0] ?? "";
  if (!localPart) return "";

  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const OrderStatus = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        navigate("/auth", { replace: true });
        return;
      }
      setUser(currentUser);
    });

    return unsubscribe;
  }, [navigate]);

  const loadOrders = useCallback(async () => {
    if (!auth.currentUser) return;

    setLoading(true);
    const ordersQuery = query(
      collection(db, "orders"),
      where("uid", "==", auth.currentUser.uid)
    );

    const snapshot = await getDocs(ordersQuery);
    const mapped = snapshot.docs.map((doc) => {
      const data = doc.data() as DocumentData;
      return {
        id: doc.id,
        orderNumber:
          typeof data.orderNumber === "string" && data.orderNumber
            ? data.orderNumber
            : "",
        total: typeof data.total === "number" ? data.total : Number(data.total ?? 0),
        status: typeof data.status === "string" ? data.status : "placed",
        createdAt: asDate(data.createdAt),
        items: parseOrderItems(data.items),
      };
    });

    mapped.sort((a, b) => {
      const aTime = a.createdAt?.getTime() ?? 0;
      const bTime = b.createdAt?.getTime() ?? 0;
      return bTime - aTime;
    });

    mapped.forEach((order, index) => {
      if (!order.orderNumber) {
        order.orderNumber = formatOrderNumber(index);
      }
    });

    setOrders(mapped);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadOrders();
  }, [user, loadOrders]);

  const orderSummary = useMemo(() => {
    return `${orders.length} order${orders.length === 1 ? "" : "s"}`;
  }, [orders]);

  const userName = useMemo(() => deriveUserName(user), [user]);

  const handleSignOut = async () => {
    await signOutUser();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold text-primary tracking-wider">Order Status</h1>
            <p className="text-sm text-muted-foreground">
              {userName || user?.email || "User"} • {orderSummary}
            </p>
          </div>
          <Button variant="outline" onClick={handleSignOut}>Sign out</Button>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 md:p-6 space-y-4">
          <h2 className="font-display text-sm uppercase tracking-widest text-primary">My Orders</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading orders...</p>
          ) : orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders yet. Place your first order below.</p>
          ) : (
            <div className="space-y-2">
              {orders.map((order) => (
                <div key={order.id} className="bg-secondary rounded-md px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-secondary-foreground">{order.orderNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.createdAt ? order.createdAt.toLocaleString() : "Pending timestamp"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm uppercase tracking-wider text-primary">{order.status}</p>
                      <p className="font-display text-secondary-foreground">Rs {order.total}</p>
                    </div>
                  </div>

                  <div className="border border-border rounded-md p-2 bg-card/60 space-y-1">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Ordered Items</p>
                    {order.items.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No item details found.</p>
                    ) : (
                      order.items.map((item, idx) => (
                        <div key={`${order.id}-${idx}`} className="flex items-center justify-between text-sm">
                          <span className="text-secondary-foreground">
                            {item.productName} ({item.quantityLabel})
                          </span>
                          <span className="font-medium text-primary">Rs {item.total}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <OrderForm defaultName={userName} onOrderPlaced={() => void loadOrders()} />
      </div>
    </div>
  );
};

export default OrderStatus;
