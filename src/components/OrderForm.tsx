import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { products, type Product } from "@/lib/products";
import { toast } from "sonner";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore/lite";
import { db, getSignedInUser } from "@/lib/firebase";

interface OrderItem {
  product: Product;
  selectionType: "preset";
  presetKey?: string;
  total: number;
}

interface OrderFormProps {
  onOrderPlaced?: (orderId?: string) => void;
  defaultName?: string;
}

const createOrderNumber = (id: string): string => {
  return `ORD-${id.slice(0, 6).toUpperCase()}`;
};

const OrderForm = ({ onOrderPlaced, defaultName = "" }: OrderFormProps) => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const marketplaceProducts = useMemo(() => products, []);
  const [selectedTierByProduct, setSelectedTierByProduct] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!name && defaultName) {
      setName(defaultName);
    }
  }, [defaultName, name]);

  useEffect(() => {
    setSelectedTierByProduct((prev) => {
      if (Object.keys(prev).length > 0) {
        return prev;
      }

      return marketplaceProducts.reduce<Record<string, string>>((acc, product) => {
        acc[product.id] = `${product.tiers[0]?.quantity ?? ""}`;
        return acc;
      }, {});
    });
  }, [marketplaceProducts]);

  const grandTotal = useMemo(
    () => orderItems.reduce((sum, item) => sum + item.total, 0),
    [orderItems]
  );

  const addMarketplaceItem = (product: Product) => {
    const selectedTierValue = selectedTierByProduct[product.id];
    const tier = product.tiers.find((currentTier) => `${currentTier.quantity}` === selectedTierValue);

    if (!tier) {
      toast.error("Select a quantity before adding");
      return;
    }

    const item: OrderItem = {
      product,
      selectionType: "preset",
      presetKey: `${tier.quantity} pcs`,
      total: tier.price,
    };

    setOrderItems((prev) => [...prev, item]);
    toast.success(`${product.name} added to cart`);
  };

  const removeItem = (index: number) => {
    setOrderItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!name || !contact) {
      toast.error("Please fill all fields");
      return;
    }
    if (orderItems.length === 0) {
      toast.error("Add at least one product");
      return;
    }

    setSubmitting(true);
    try {
      const user = getSignedInUser();
      const email = user.email ?? "";

      if (!email) {
        throw new Error("Google account email not available.");
      }

      const orderRef = doc(collection(db, "orders"));
      const orderNumber = createOrderNumber(orderRef.id);

      await setDoc(orderRef, {
        uid: user.uid,
        orderNumber,
        customer: {
          name,
          contact,
          email,
        },
        status: "placed",
        items: orderItems.map((item) => ({
          productId: item.product.id,
          productName: item.product.name,
          selectionType: item.selectionType,
          presetKey: item.presetKey ?? null,
          total: item.total,
        })),
        total: grandTotal,
        createdAt: serverTimestamp(),
      });

      toast.success("Pre-order placed successfully!");
      resetForm();
      onOrderPlaced?.(orderRef.id);
      navigate(`/payment/${orderRef.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const lowerMessage = message.toLowerCase();

      if (lowerMessage.includes("not signed in")) {
        toast.error("Please sign in with Google before submitting.");
      } else if (lowerMessage.includes("permission-denied")) {
        toast.error("Firestore denied write access. Update Firestore rules to allow authenticated users.");
      } else if (lowerMessage.includes("google account email not available")) {
        toast.error("Could not read your Google email. Please retry sign-in.");
      } else {
        toast.error("Failed to submit. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setName(defaultName || "");
    setContact("");
    setOrderItems([]);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.08),_transparent_45%),linear-gradient(150deg,_hsl(var(--background))_0%,_hsl(var(--secondary)/0.25)_100%)] p-4 md:p-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="rounded-2xl border border-border bg-card/80 px-5 py-6 backdrop-blur-sm md:px-8">
          <h1 className="font-display text-3xl font-bold tracking-wider text-primary md:text-4xl">Xenon Labs Marketplace</h1>
          <p className="mt-2 text-sm text-muted-foreground">Add products with the + button, review cart totals, then submit and continue to payment form.</p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Customer details</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
                <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Phone number" />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">All products</p>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">{marketplaceProducts.length} options</span>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {marketplaceProducts.map((product) => {
                  const selectedTierValue = selectedTierByProduct[product.id] ?? "";
                  const selectedTierPrice = product.tiers.find((tier) => `${tier.quantity}` === selectedTierValue)?.price ?? product.tiers[0]?.price ?? 0;

                  return (
                    <div key={product.id} className="group rounded-xl border border-border bg-secondary/35 p-4 transition-colors hover:border-primary/60">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-display text-lg font-bold text-foreground">{product.name}</h3>
                          <p className="mt-1 text-xs text-muted-foreground">Starting at Rs {product.tiers[0]?.price ?? 0}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => addMarketplaceItem(product)}
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-lg font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                          aria-label={`Add ${product.name}`}
                        >
                          +
                        </button>
                      </div>

                      <div className="mt-3">
                        <Select
                          value={selectedTierValue}
                          onValueChange={(value) => {
                            setSelectedTierByProduct((prev) => ({ ...prev, [product.id]: value }));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select quantity" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectLabel>{product.name} pricing</SelectLabel>
                              {product.tiers.map((tier) => (
                                <SelectItem key={`${product.id}-${tier.quantity}`} value={`${tier.quantity}`}>
                                  {tier.quantity} pcs - Rs {tier.price}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </div>

                      <p className="mt-3 text-sm font-semibold text-primary">Selected price: Rs {selectedTierPrice}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="sticky top-4 rounded-2xl border border-border bg-card p-5 md:p-6">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Cart review</p>

              <div className="mt-4 space-y-2">
                {orderItems.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">Your cart is empty. Tap + on any card to add items.</p>
                ) : (
                  orderItems.map((item, i) => (
                    <div key={`${item.product.id}-${i}`} className="flex items-center justify-between rounded-md bg-secondary px-3 py-2 text-sm">
                      <div>
                        <p className="font-medium text-secondary-foreground">{item.product.name}</p>
                        <p className="text-xs text-muted-foreground">{item.presetKey}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-display font-semibold text-primary">Rs {item.total}</span>
                        <button
                          type="button"
                          onClick={() => removeItem(i)}
                          className="text-xs text-muted-foreground transition-colors hover:text-destructive"
                          aria-label="Remove item"
                        >
                          x
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-5 border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm uppercase tracking-wider text-muted-foreground">Total</span>
                  <span className="font-display text-3xl font-bold text-primary">Rs {grandTotal}</span>
                </div>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="mt-5 h-12 w-full font-display text-sm uppercase tracking-wider"
              >
                {submitting ? "Submitting..." : "Place Order"}
              </Button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">© {new Date().getFullYear()} Xenon Labs. All rights reserved.</p>
      </div>
    </div>
  );
};

export default OrderForm;
