import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, serverTimestamp, updateDoc, type DocumentData } from "firebase/firestore/lite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { auth, db, signOutUser } from "@/lib/firebase";
import { toast } from "sonner";

type PaymentOrder = {
  id: string;
  uid: string;
  orderNumber: string;
  total: number;
  status: string;
};

const PAYMENT_UPI_ID = import.meta.env.VITE_PAYMENT_UPI_ID || "jitmadridista-1@oksbi";
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
const CLOUDINARY_FOLDER = import.meta.env.VITE_CLOUDINARY_FOLDER;

const Payment = () => {
  const navigate = useNavigate();
  const { orderId = "" } = useParams();

  const [user, setUser] = useState<User | null>(null);
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [transactionId, setTransactionId] = useState("");
  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);

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

  useEffect(() => {
    const loadOrder = async () => {
      if (!user || !orderId) return;

      setLoading(true);
      try {
        const orderRef = doc(db, "orders", orderId);
        const snapshot = await getDoc(orderRef);

        if (!snapshot.exists()) {
          toast.error("Order not found.");
          navigate("/status", { replace: true });
          return;
        }

        const data = snapshot.data() as DocumentData;
        const orderUid = typeof data.uid === "string" ? data.uid : "";

        if (!orderUid || orderUid !== user.uid) {
          toast.error("You are not allowed to access this payment page.");
          navigate("/status", { replace: true });
          return;
        }

        setOrder({
          id: snapshot.id,
          uid: orderUid,
          orderNumber:
            typeof data.orderNumber === "string" && data.orderNumber
              ? data.orderNumber
              : `ORD-${snapshot.id.slice(0, 6).toUpperCase()}`,
          total: typeof data.total === "number" ? data.total : Number(data.total ?? 0),
          status: typeof data.status === "string" ? data.status : "placed",
        });
      } catch {
        toast.error("Failed to load order details.");
      } finally {
        setLoading(false);
      }
    };

    void loadOrder();
  }, [navigate, orderId, user]);

  const cloudinaryReady = useMemo(
    () => Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET),
    []
  );

  const handleCopyUpiId = async () => {
    try {
      await navigator.clipboard.writeText(PAYMENT_UPI_ID);
      toast.success("UPI ID copied");
    } catch {
      toast.error("Unable to copy UPI ID");
    }
  };

  const uploadToCloudinary = async (file: File): Promise<string> => {
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
      throw new Error("Cloudinary configuration is missing.");
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    if (CLOUDINARY_FOLDER) {
      formData.append("folder", CLOUDINARY_FOLDER);
    }

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error("Cloudinary upload failed");
    }

    const data = (await response.json()) as { secure_url?: string };

    if (!data.secure_url) {
      throw new Error("Cloudinary did not return image URL");
    }

    return data.secure_url;
  };

  const handleSubmitPayment = async () => {
    if (!order) return;

    if (!transactionId.trim()) {
      toast.error("Please enter transaction ID");
      return;
    }

    if (!paymentScreenshot) {
      toast.error("Please upload your payment screenshot");
      return;
    }

    if (!cloudinaryReady) {
      toast.error("Cloudinary is not configured yet.");
      return;
    }

    setSubmitting(true);
    try {
      const screenshotUrl = await uploadToCloudinary(paymentScreenshot);

      await updateDoc(doc(db, "orders", order.id), {
        status: "payment_submitted",
        payment: {
          transactionId: transactionId.trim(),
          screenshotUrl,
          submittedAt: serverTimestamp(),
          upiId: PAYMENT_UPI_ID,
        },
        paymentSubmittedAt: serverTimestamp(),
      });

      toast.success("Payment proof submitted successfully!");
      navigate("/status", { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Payment submission failed. ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    navigate("/auth", { replace: true });
  };

  if (loading) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!order) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-wider text-primary">Payment Page</h1>
            <p className="text-sm text-muted-foreground">Submit transaction details for {order.orderNumber}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/status")}>Back to Orders</Button>
            <Button variant="outline" onClick={handleSignOut}>Sign out</Button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md bg-secondary p-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Order Number</p>
              <p className="font-display text-secondary-foreground">{order.orderNumber}</p>
            </div>
            <div className="rounded-md bg-secondary p-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Amount</p>
              <p className="font-display text-secondary-foreground">Rs {order.total}</p>
            </div>
            <div className="rounded-md bg-secondary p-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Status</p>
              <p className="font-display text-primary uppercase">{order.status}</p>
            </div>
          </div>

          <div className="rounded-md border border-border p-4 bg-secondary/40 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-secondary-foreground">
                UPI ID: <span className="font-semibold">{PAYMENT_UPI_ID}</span>
              </p>
              <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={handleCopyUpiId}>
                Copy UPI ID
              </Button>
            </div>

            <div className="rounded-md border border-border bg-card p-2">
              <img src="/qrjit.jpeg" alt="UPI QR code" className="mx-auto w-full max-w-xs rounded-md object-contain" />
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Transaction ID
              </label>
              <Input
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="Enter payment transaction ID"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Payment Screenshot
              </label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setPaymentScreenshot(e.target.files?.[0] ?? null)}
              />
            </div>

            {!cloudinaryReady && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                Cloudinary is not configured. Add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in your env.
              </p>
            )}

            <Button onClick={handleSubmitPayment} disabled={submitting || !cloudinaryReady} className="w-full h-11 uppercase tracking-wider">
              {submitting ? "Uploading..." : "Submit Payment Proof"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Payment;
