import { useState, useMemo } from "react";
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
import { products, calculateCustomPrice, type Product } from "@/lib/products";
import { toast } from "sonner";

const GOOGLE_SHEET_URL = ""; // User will set this

interface OrderItem {
  product: Product;
  selectionType: "preset" | "custom";
  presetKey?: string;
  customQty?: number;
  total: number;
}

const OrderForm = () => {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedTier, setSelectedTier] = useState("");
  const [customQty, setCustomQty] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const currentProduct = useMemo(
    () => products.find((p) => p.id === selectedProduct),
    [selectedProduct]
  );

  const currentItemTotal = useMemo(() => {
    if (!currentProduct) return 0;
    if (isCustom && customQty) {
      return calculateCustomPrice(currentProduct, parseInt(customQty));
    }
    if (!isCustom && selectedTier) {
      const tier = currentProduct.tiers.find(
        (t) => `${t.quantity}` === selectedTier
      );
      return tier?.price ?? 0;
    }
    return 0;
  }, [currentProduct, isCustom, customQty, selectedTier]);

  const grandTotal = useMemo(
    () => orderItems.reduce((sum, item) => sum + item.total, 0),
    [orderItems]
  );

  const addItem = () => {
    if (!currentProduct) return;
    let item: OrderItem;
    if (isCustom) {
      const qty = parseInt(customQty);
      if (!qty || qty <= 0) {
        toast.error("Enter a valid quantity");
        return;
      }
      item = {
        product: currentProduct,
        selectionType: "custom",
        customQty: qty,
        total: calculateCustomPrice(currentProduct, qty),
      };
    } else {
      const tier = currentProduct.tiers.find(
        (t) => `${t.quantity}` === selectedTier
      );
      if (!tier) {
        toast.error("Select a quantity");
        return;
      }
      item = {
        product: currentProduct,
        selectionType: "preset",
        presetKey: `${tier.quantity} pcs`,
        total: tier.price,
      };
    }
    setOrderItems((prev) => [...prev, item]);
    setSelectedProduct("");
    setSelectedTier("");
    setCustomQty("");
    setIsCustom(false);
    toast.success(`${item.product.name} added`);
  };

  const removeItem = (index: number) => {
    setOrderItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!name || !contact || !email || !address) {
      toast.error("Please fill all fields");
      return;
    }
    if (orderItems.length === 0) {
      toast.error("Add at least one product");
      return;
    }

    const itemsSummary = orderItems
      .map(
        (item) =>
          `${item.product.name} (${item.selectionType === "custom" ? `${item.customQty} pcs custom` : item.presetKey}) - ₹${item.total}`
      )
      .join(" | ");

    const payload = {
      name,
      contact,
      email,
      address,
      products: itemsSummary,
      total: grandTotal,
      date: new Date().toLocaleString(),
    };

    if (!GOOGLE_SHEET_URL) {
      toast.info("Google Sheet URL not configured. Order details logged to console.");
      console.log("Order payload:", payload);
      toast.success("Pre-order placed successfully!");
      resetForm();
      return;
    }

    setSubmitting(true);
    try {
      await fetch(GOOGLE_SHEET_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      toast.success("Pre-order placed successfully!");
      resetForm();
    } catch {
      toast.error("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setName("");
    setContact("");
    setEmail("");
    setAddress("");
    setOrderItems([]);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-primary tracking-wider mb-2">
            XENON LABS
          </h1>
          <div className="h-px w-32 mx-auto bg-gradient-to-r from-transparent via-primary to-transparent" />
          <p className="text-muted-foreground mt-3 text-sm tracking-wide uppercase">
            Pre-Order Form
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-5 shadow-glow">
          {/* Personal Info */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Contact
              </label>
              <Input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Phone number"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Email
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Address
              </label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Delivery address"
              />
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Product Selection */}
          <div className="space-y-4">
            <h2 className="font-display text-sm font-semibold text-primary tracking-wider uppercase">
              Product Selection
            </h2>

            <Select
              value={selectedProduct}
              onValueChange={(val) => {
                setSelectedProduct(val);
                setSelectedTier("");
                setCustomQty("");
                setIsCustom(false);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {currentProduct && (
              <div className="space-y-3">
                {/* Preset tiers */}
                <Select
                  value={isCustom ? "custom" : selectedTier}
                  onValueChange={(val) => {
                    if (val === "custom") {
                      setIsCustom(true);
                      setSelectedTier("");
                    } else {
                      setIsCustom(false);
                      setSelectedTier(val);
                      setCustomQty("");
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select quantity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>{currentProduct.name} Pricing</SelectLabel>
                      {currentProduct.tiers.map((tier) => (
                        <SelectItem
                          key={tier.quantity}
                          value={`${tier.quantity}`}
                        >
                          {tier.quantity} piece{tier.quantity > 1 ? "s" : ""} — ₹
                          {tier.price}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">Custom quantity</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>

                {isCustom && (
                  <Input
                    type="number"
                    min="1"
                    value={customQty}
                    onChange={(e) => setCustomQty(e.target.value)}
                    placeholder="Enter quantity"
                  />
                )}

                {currentItemTotal > 0 && (
                  <div className="flex items-center justify-between bg-secondary rounded-md px-4 py-2">
                    <span className="text-sm text-secondary-foreground">
                      Item Total
                    </span>
                    <span className="font-display font-bold text-primary">
                      ₹{currentItemTotal}
                    </span>
                  </div>
                )}

                <Button
                  onClick={addItem}
                  className="w-full"
                  variant="outline"
                >
                  + Add to Order
                </Button>
              </div>
            )}
          </div>

          {/* Order Items */}
          {orderItems.length > 0 && (
            <>
              <div className="h-px bg-border" />
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Order Summary
                </h3>
                {orderItems.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-secondary rounded-md px-3 py-2 text-sm"
                  >
                    <div className="text-secondary-foreground">
                      <span className="font-medium">{item.product.name}</span>
                      <span className="text-muted-foreground ml-2">
                        {item.selectionType === "custom"
                          ? `${item.customQty} pcs`
                          : item.presetKey}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-display text-primary font-semibold">
                        ₹{item.total}
                      </span>
                      <button
                        onClick={() => removeItem(i)}
                        className="text-muted-foreground hover:text-destructive transition-colors text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Total */}
          <div className="h-px bg-border" />
          <div className="flex items-center justify-between px-1">
            <span className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">
              Total
            </span>
            <span className="font-display text-2xl font-bold text-primary">
              ₹{grandTotal}
            </span>
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full h-12 font-display text-sm tracking-widest uppercase animate-pulse-glow"
          >
            {submitting ? "Submitting..." : "⚡ Pre-Order Now"}
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © {new Date().getFullYear()} Xenon Labs. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default OrderForm;
