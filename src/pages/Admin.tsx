import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  type DocumentData,
  updateDoc,
} from "firebase/firestore/lite";
import { Button } from "@/components/ui/button";
import { auth, db, isAdminEmail, signOutUser } from "@/lib/firebase";
import { toast } from "sonner";

type AdminOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerContact: string;
  customerEmail: string;
  total: number;
  status: string;
  createdAt?: Date;
  paymentTransactionId: string;
  paymentScreenshotUrl: string;
  paymentSubmittedAt?: Date;
  paymentUpiId: string;
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

const parseOrderItems = (value: unknown): AdminOrder["items"] => {
  if (!Array.isArray(value)) return [];

  return value.map((item) => {
    const data = (item ?? {}) as Record<string, unknown>;
    const presetKey = typeof data.presetKey === "string" ? data.presetKey : "";

    return {
      productName: typeof data.productName === "string" ? data.productName : "Unknown Product",
      quantityLabel: presetKey || "Preset quantity",
      total: typeof data.total === "number" ? data.total : Number(data.total ?? 0),
    };
  });
};

const toCsv = (orders: AdminOrder[]): string => {
  const headers = [
    "orderNumber",
    "orderId",
    "name",
    "contact",
    "email",
    "items",
    "status",
    "total",
    "paymentTransactionId",
    "paymentScreenshotUrl",
    "paymentUpiId",
    "paymentSubmittedAt",
    "createdAt",
  ];

  const escape = (value: string | number) => {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  };

  const rows = orders.map((order) => [
    escape(order.orderNumber),
    escape(order.id),
    escape(order.customerName),
    escape(order.customerContact),
    escape(order.customerEmail),
    escape(order.items.map((item) => `${item.productName} (${item.quantityLabel})`).join(" | ")),
    escape(order.status),
    escape(order.total),
    escape(order.paymentTransactionId),
    escape(order.paymentScreenshotUrl),
    escape(order.paymentUpiId),
    escape(order.paymentSubmittedAt ? order.paymentSubmittedAt.toISOString() : ""),
    escape(order.createdAt ? order.createdAt.toISOString() : ""),
  ]);

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
};

const downloadCsv = (filename: string, content: string) => {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const Admin = () => {
  const navigate = useNavigate();
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>("");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate("/auth", { replace: true });
        return;
      }

      if (!isAdminEmail(user.email)) {
        navigate("/status", { replace: true });
        return;
      }

      setAdminUser(user);
    });

    return unsubscribe;
  }, [navigate]);

  useEffect(() => {
    const load = async () => {
      if (!adminUser) return;

      setLoading(true);
      setLoadError("");

      try {
        const snapshot = await getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc")));
        const mapped = snapshot.docs.map((doc, index) => {
          const data = doc.data() as DocumentData;
          const customer = (data.customer ?? {}) as Record<string, unknown>;
          const payment = (data.payment ?? {}) as Record<string, unknown>;

          return {
            id: doc.id,
            orderNumber:
              typeof data.orderNumber === "string" && data.orderNumber
                ? data.orderNumber
                : formatOrderNumber(index),
            customerName: typeof customer.name === "string" ? customer.name : "",
            customerContact: typeof customer.contact === "string" ? customer.contact : "",
            customerEmail: typeof customer.email === "string" ? customer.email : "",
            total: typeof data.total === "number" ? data.total : Number(data.total ?? 0),
            status: typeof data.status === "string" ? data.status : "placed",
            createdAt: asDate(data.createdAt),
            paymentTransactionId: typeof payment.transactionId === "string" ? payment.transactionId : "",
            paymentScreenshotUrl: typeof payment.screenshotUrl === "string" ? payment.screenshotUrl : "",
            paymentUpiId: typeof payment.upiId === "string" ? payment.upiId : "",
            paymentSubmittedAt: asDate(payment.submittedAt),
            items: parseOrderItems(data.items),
          } as AdminOrder;
        });

        setOrders(mapped);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message.toLowerCase().includes("permission")) {
          setLoadError("Missing or insufficient permissions. Update Firestore rules to allow admin read access.");
          toast.error("Admin read blocked by Firestore rules.");
        } else {
          setLoadError("Failed to load orders. Please try again.");
        }
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [adminUser]);

  const totalRevenue = useMemo(() => orders.reduce((sum, order) => sum + order.total, 0), [orders]);

  const handleExport = () => {
    const csv = toCsv(orders);
    downloadCsv(`orders-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  const handleSignOut = async () => {
    await signOutUser();
    navigate("/auth", { replace: true });
  };

  const handleMarkCompleted = async (orderId: string) => {
    setUpdatingOrderId(orderId);
    try {
      await updateDoc(doc(db, "orders", orderId), {
        status: "completed",
        completedAt: serverTimestamp(),
      });

      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? {
                ...order,
                status: "completed",
              }
            : order
        )
      );
      toast.success("Order marked as completed");
    } catch {
      toast.error("Failed to update order status");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-wider text-primary">Admin Panel</h1>
            <p className="text-sm text-muted-foreground">
              {orders.length} orders • Rs {totalRevenue}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExport} disabled={orders.length === 0}>Export CSV</Button>
            <Button variant="outline" onClick={handleSignOut}>Sign out</Button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 md:p-6 space-y-3">
          <h2 className="font-display text-sm uppercase tracking-widest text-primary">All Orders</h2>
          {loadError && <p className="text-sm text-destructive">{loadError}</p>}
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading orders...</p>
          ) : orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders found.</p>
          ) : (
            <div className="space-y-2">
              {orders.map((order) => (
                <div key={order.id} className="bg-secondary rounded-md px-4 py-3 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Order</p>
                      <p className="text-sm font-medium text-secondary-foreground">{order.orderNumber}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Customer</p>
                      <p className="text-sm text-secondary-foreground">{order.customerName}</p>
                      <p className="text-xs text-muted-foreground">{order.customerEmail}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Contact</p>
                      <p className="text-sm text-secondary-foreground">{order.customerContact}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <p className="text-sm uppercase tracking-wider text-primary">{order.status}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Payment</p>
                      <p className="text-sm text-secondary-foreground">
                        {order.paymentTransactionId || "Pending"}
                      </p>
                    </div>
                    <div className="md:text-right">
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="font-display text-secondary-foreground">Rs {order.total}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.createdAt ? order.createdAt.toLocaleString() : "Pending timestamp"}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <div className="flex gap-2">
                      {order.status !== "completed" && (
                        <Button
                          type="button"
                          className="h-8 px-3 text-xs"
                          disabled={updatingOrderId === order.id}
                          onClick={() => void handleMarkCompleted(order.id)}
                        >
                          {updatingOrderId === order.id ? "Updating..." : "Mark Completed"}
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-3 text-xs"
                        onClick={() =>
                          setExpandedOrderId((prev) => (prev === order.id ? null : order.id))
                        }
                      >
                        {expandedOrderId === order.id ? "Hide Items" : "View Items"}
                      </Button>
                    </div>
                  </div>

                  {expandedOrderId === order.id && (
                    <div className="border border-border rounded-md p-3 bg-card/60 space-y-2">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">
                        Ordered Items
                      </p>
                      {order.items.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No item details found.</p>
                      ) : (
                        <div className="space-y-1">
                          {order.items.map((item, idx) => (
                            <div
                              key={`${order.id}-${idx}`}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="text-secondary-foreground">
                                {item.productName} ({item.quantityLabel})
                              </span>
                              <span className="font-medium text-primary">Rs {item.total}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="pt-2 border-t border-border space-y-2">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">Payment Details</p>
                        <p className="text-sm text-secondary-foreground">
                          UPI ID: <span className="font-medium">{order.paymentUpiId || "Not submitted"}</span>
                        </p>
                        <p className="text-sm text-secondary-foreground">
                          Transaction ID: <span className="font-medium">{order.paymentTransactionId || "Not submitted"}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Submitted: {order.paymentSubmittedAt ? order.paymentSubmittedAt.toLocaleString() : "Not submitted"}
                        </p>
                        {order.paymentScreenshotUrl ? (
                          <div className="space-y-2">
                            <a
                              href={order.paymentScreenshotUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary underline"
                            >
                              Open payment screenshot
                            </a>
                            <img
                              src={order.paymentScreenshotUrl}
                              alt={`Payment screenshot ${order.orderNumber}`}
                              className="w-full max-w-sm rounded-md border border-border"
                            />
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Payment screenshot not submitted.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
